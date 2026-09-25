import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { verifyEmailMessage } from '../emails/verifyEmail.js'
import { assertNotLocked } from '../lib/accountStatus.js'
import { env } from '../env.js'
import { HttpError, duplicateKeyField } from '../lib/errors.js'
import { verifyGoogleCredential } from '../lib/google.js'
import { findOrCreateGoogleUser } from '../lib/googleAccount.js'
import { sendMail } from '../lib/mailer.js'
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from '../lib/schemas.js'
import { signToken } from '../lib/token.js'
import { RESEND_COOLDOWN_MS, createVerifyToken, hashToken } from '../lib/verification.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { getSettings } from '../models/Setting.js'
import { User, toPublicUser } from '../models/User.js'
import type { UserRecord } from '../models/User.js'

const BCRYPT_ROUNDS = 10

const registerSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})

// Login deliberately does not re-check the password policy: accounts created
// before a rule existed must still be able to sign in.
const loginSchema = z.object({
  email: z.string('Vui lòng nhập email').trim().toLowerCase().min(1, 'Vui lòng nhập email'),
  password: z.string('Vui lòng nhập mật khẩu').min(1, 'Vui lòng nhập mật khẩu'),
})

const verifySchema = z.object({
  token: z.string('Thiếu mã xác nhận').min(1, 'Thiếu mã xác nhận').max(200, 'Mã xác nhận không hợp lệ'),
})

const resendSchema = z.object({ email: emailSchema })

const googleSchema = z.object({
  credential: z.string('Thiếu thông tin đăng nhập Google').min(1, 'Thiếu thông tin đăng nhập Google').max(4096),
})

const INVALID_LOGIN = 'Email hoặc mật khẩu không đúng'
const INVALID_VERIFY_LINK = 'Liên kết xác nhận không hợp lệ, đã được dùng hoặc đã hết hạn.'

/**
 * Compared against when the email does not exist, so a wrong email takes as
 * long to reject as a wrong password and response time does not reveal which
 * emails are registered.
 */
let dummyHash: Promise<string> | null = null
function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash('chillngo-timing-dummy', BCRYPT_ROUNDS)
  return dummyHash
}

/**
 * Slows down password and token guessing. Counts failed attempts only.
 *
 * The counter lives in memory, so on Vercel each function instance keeps its
 * own. That still stops a naive brute-force loop, but it is not a hard global
 * limit; use Vercel Firewall rate limiting for that.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' },
})

/** Resend always answers 200, so every request counts here. */
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn đã yêu cầu gửi lại quá nhiều lần. Vui lòng đợi vài phút.' },
})

function session(user: UserRecord) {
  return { token: signToken(user), user: toPublicUser(user) }
}

const REGISTRATION_CLOSED = 'ChillnGo đang tạm ngừng nhận đăng ký tài khoản mới.'

async function assertRegistrationOpen(): Promise<void> {
  if (!(await getSettings()).registrationOpen) {
    throw new HttpError(403, REGISTRATION_CLOSED, 'REGISTRATION_CLOSED')
  }
}

/** Stamps the sign-in time shown in the admin user list. */
function recordLogin(userId: string): Promise<unknown> {
  return User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } })
}

async function sendVerificationEmail(
  user: { email: string; displayName: string; username: string },
  token: string,
): Promise<void> {
  const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`
  await sendMail(
    verifyEmailMessage({
      to: user.email,
      displayName: user.displayName,
      username: user.username,
      verifyUrl,
    }),
  )
  if (env.smtp) console.log(`Verification email sent to ${user.email}`)
}

export const authRouter = Router()

/**
 * POST /api/auth/register → 201 { email, emailSent }
 *
 * Creates an unverified account and emails a confirmation link. No token is
 * returned: the user signs in by opening that link.
 */
authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body)
  await assertRegistrationOpen()
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const verify = createVerifyToken()

  let user
  try {
    user = await User.create({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      emailVerifyTokenHash: verify.hash,
      emailVerifyExpiresAt: verify.expiresAt,
      emailVerifySentAt: new Date(),
    })
  } catch (error) {
    const field = duplicateKeyField(error)
    if (field === 'email') throw new HttpError(409, 'Email này đã được đăng ký')
    if (field === 'username') throw new HttpError(409, 'Tên người dùng này đã có người dùng')
    throw error
  }

  // The account exists either way. If the email fails, the user can ask for
  // another one from the next screen, so this is not an error response.
  let emailSent = true
  try {
    await sendVerificationEmail(user, verify.token)
  } catch (error) {
    console.error('Could not send verification email:', error)
    emailSent = false
  }

  res.status(201).json({ email: user.email, emailSent })
})

/**
 * POST /api/auth/login → 200 { token, user }
 * 403 with code EMAIL_NOT_VERIFIED when the password is right but the email
 * has not been confirmed yet.
 */
authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = await User.findOne({ email }).select('+passwordHash')

  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()))
  if (user && !user.passwordHash) {
    throw new HttpError(
      401,
      'Tài khoản này được tạo bằng Google và không có mật khẩu. Hãy bấm "Tiếp tục với Google".',
      'USE_GOOGLE',
    )
  }
  if (!user || !ok) throw new HttpError(401, INVALID_LOGIN)

  if (!user.emailVerified) {
    throw new HttpError(
      403,
      'Email của bạn chưa được xác nhận. Hãy bấm nút trong email xác nhận chúng tôi đã gửi, hoặc gửi lại email mới.',
      'EMAIL_NOT_VERIFIED',
    )
  }
  assertNotLocked(user)

  await recordLogin(user._id)
  res.json(session(user))
})

/**
 * POST /api/auth/google { credential } → 200 { token, user }
 *
 * `credential` is the ID token from the "Sign in with Google" button. Signs in
 * the linked account, links an existing account with the same email, or
 * creates a new one. Google accounts count as email-verified.
 */
authRouter.post('/google', authLimiter, async (req, res) => {
  const { credential } = googleSchema.parse(req.body)
  const profile = await verifyGoogleCredential(credential)
  const { registrationOpen } = await getSettings()
  const user = await findOrCreateGoogleUser(profile, { allowCreate: registrationOpen })
  assertNotLocked(user)

  await recordLogin(user._id)
  res.json(session(user))
})

/**
 * POST /api/auth/verify-email { token } → 200 { token, user }
 *
 * Confirms the address and signs the user in. The link is single-use: the
 * stored hash is removed in the same atomic update that marks the email
 * verified, so two clicks cannot both succeed.
 */
authRouter.post('/verify-email', authLimiter, async (req, res) => {
  const { token } = verifySchema.parse(req.body)

  const user = await User.findOneAndUpdate(
    { emailVerifyTokenHash: hashToken(token), emailVerifyExpiresAt: { $gt: new Date() } },
    {
      $set: { emailVerified: true },
      $unset: { emailVerifyTokenHash: 1, emailVerifyExpiresAt: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!user) throw new HttpError(400, INVALID_VERIFY_LINK, 'INVALID_VERIFY_TOKEN')
  assertNotLocked(user)

  await recordLogin(user._id)
  res.json(session(user))
})

/**
 * POST /api/auth/resend-verification { email } → 200 { message }
 *
 * Says exactly what happened, so the page never claims an email was sent
 * when it was not. (Hiding whether an email is registered would gain nothing:
 * register already answers 409 for a taken email.) Sending a new link
 * invalidates the previous one.
 *
 *   404 NO_ACCOUNT        no account with this email
 *   409 ALREADY_VERIFIED  nothing to confirm, the user can log in
 *   429 RESEND_COOLDOWN   an email went out less than a minute ago
 */
authRouter.post('/resend-verification', resendLimiter, async (req, res) => {
  const { email } = resendSchema.parse(req.body)
  const user = await User.findOne({ email }).select('+emailVerifySentAt')

  if (!user) {
    throw new HttpError(404, 'Không có tài khoản nào đăng ký bằng email này.', 'NO_ACCOUNT')
  }
  if (user.emailVerified) {
    throw new HttpError(
      409,
      'Email này đã được xác nhận rồi. Bạn có thể đăng nhập ngay.',
      'ALREADY_VERIFIED',
    )
  }

  const waitMs = (user.emailVerifySentAt?.getTime() ?? 0) + RESEND_COOLDOWN_MS - Date.now()
  if (waitMs > 0) {
    throw new HttpError(
      429,
      `Email vừa được gửi. Vui lòng đợi ${Math.ceil(waitMs / 1000)} giây rồi thử lại.`,
      'RESEND_COOLDOWN',
    )
  }

  const verify = createVerifyToken()
  user.set({
    emailVerifyTokenHash: verify.hash,
    emailVerifyExpiresAt: verify.expiresAt,
    emailVerifySentAt: new Date(),
  })
  await user.save()

  try {
    await sendVerificationEmail(user, verify.token)
  } catch (error) {
    console.error('Could not resend verification email:', error)
    throw new HttpError(502, 'Không gửi được email xác nhận. Vui lòng thử lại sau.')
  }

  res.json({ message: `Đã gửi email xác nhận mới tới ${user.email}.` })
})

/** GET /api/auth/me → 200 { user }. Used to validate a stored token. */
authRouter.get('/me', requireAuth, loadCurrentUser, (_req, res) => {
  res.json({ user: toPublicUser(currentUser(res)) })
})
