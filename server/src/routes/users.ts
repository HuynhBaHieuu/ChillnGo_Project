/**
 * /api/users/me — the signed-in user's own profile.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { IMAGE_KINDS, confirmUpload, removeImage, signUpload } from '../lib/cloudinary.js'
import { HttpError, duplicateKeyField } from '../lib/errors.js'
import { displayNameSchema, usernameSchema } from '../lib/schemas.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { toPublicUser } from '../models/User.js'

export const usersRouter = Router()
usersRouter.use(requireAuth, loadCurrentUser)

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn đổi ảnh quá nhiều lần. Vui lòng đợi vài phút.' },
})

const signatureSchema = z.object({ kind: z.enum(IMAGE_KINDS, 'Loại ảnh không hợp lệ') })

/**
 * POST /api/users/me/upload-signature { kind } → { uploadUrl, fields }
 * The browser posts the file plus `fields` to `uploadUrl` (Cloudinary).
 */
usersRouter.post('/me/upload-signature', uploadLimiter, (req, res) => {
  const { kind } = signatureSchema.parse(req.body)
  res.json(signUpload(currentUser(res)._id, kind))
})

/** "uploaded": use the image just sent to Cloudinary. "remove": back to the default photo. */
const imageChange = z.enum(['uploaded', 'remove'], 'Thao tác ảnh không hợp lệ').optional()

const profileSchema = z.object({
  displayName: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  bio: z.string('Giới thiệu không hợp lệ').trim().max(300, 'Giới thiệu tối đa 300 ký tự').optional(),
  location: z.string('Nơi sống không hợp lệ').trim().max(80, 'Nơi sống tối đa 80 ký tự').optional(),
  avatar: imageChange,
  cover: imageChange,
})

/** PATCH /api/users/me — any subset of the fields above. → { user } */
usersRouter.patch('/me', async (req, res) => {
  const input = profileSchema.parse(req.body)
  const user = currentUser(res)

  if (input.displayName !== undefined) user.displayName = input.displayName
  if (input.username !== undefined) user.username = input.username
  if (input.bio !== undefined) user.bio = input.bio
  if (input.location !== undefined) user.location = input.location

  for (const kind of IMAGE_KINDS) {
    const change = input[kind]
    const field = kind === 'avatar' ? 'avatarUrl' : 'coverUrl'
    if (change === 'uploaded') user[field] = await confirmUpload(user._id, kind)
    if (change === 'remove') {
      await removeImage(user._id, kind)
      user[field] = ''
    }
  }

  try {
    await user.save()
  } catch (error) {
    if (duplicateKeyField(error) === 'username') {
      throw new HttpError(409, 'Tên người dùng này đã có người dùng.')
    }
    throw error
  }

  res.json({ user: toPublicUser(user) })
})
