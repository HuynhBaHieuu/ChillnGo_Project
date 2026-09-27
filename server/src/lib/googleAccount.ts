import { randomInt } from 'node:crypto'

import { HttpError, duplicateKeyField } from './errors.js'
import type { GoogleProfile } from './google.js'
import { recordAccountEvents } from '../models/AccountEvent.js'
import { User } from '../models/User.js'

/**
 * Finds or creates the ChillnGo account for a verified Google profile.
 *
 *   1. An account already linked to this Google id: sign it in.
 *   2. An account with the same email: link it to Google and sign it in.
 *      Google has verified the address, so this also confirms the email of
 *      an account that was still waiting for its confirmation link.
 *   3. Otherwise: create a new account with no password, when registration
 *      is open (403 REGISTRATION_CLOSED when it is not).
 */
export async function findOrCreateGoogleUser(
  profile: GoogleProfile,
  { allowCreate }: { allowCreate: boolean },
) {
  const linked = await User.findOne({ googleId: profile.sub })
  if (linked) return linked

  const byEmail = await User.findOne({ email: profile.email })
  if (byEmail) {
    byEmail.set({
      googleId: profile.sub,
      emailVerified: true,
      emailVerifyTokenHash: undefined,
      emailVerifyExpiresAt: undefined,
    })
    const verifiedNow = !byEmail.emailVerified
    if (!byEmail.avatarUrl && profile.picture) byEmail.avatarUrl = profile.picture
    await byEmail.save()
    if (verifiedNow) await recordAccountEvents(byEmail._id, [{ type: 'email_verified', details: { via: 'google' } }])
    return byEmail
  }

  if (!allowCreate) {
    throw new HttpError(403, 'ChillnGo đang tạm ngừng nhận đăng ký tài khoản mới.', 'REGISTRATION_CLOSED')
  }

  // Usernames are unique; retry with a random suffix if the one derived from
  // the email is taken (or gets taken between the check and the insert).
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = await availableUsername(profile.email, attempt > 0)
    try {
      const created = await User.create({
        username,
        displayName: (profile.name.trim() || profile.email.split('@')[0]).slice(0, 60),
        email: profile.email,
        googleId: profile.sub,
        emailVerified: true,
        avatarUrl: profile.picture ?? '',
      })
      await recordAccountEvents(created._id, [{ type: 'account_created', details: { via: 'google' } }])
      return created
    } catch (error) {
      const field = duplicateKeyField(error)
      if (field === 'username') continue
      // Two first-time Google sign-ins racing each other: the other one won.
      if (field === 'email' || field === 'googleId') {
        const existing = await User.findOne({ googleId: profile.sub })
        if (existing) return existing
      }
      throw error
    }
  }
  throw new Error('Could not find a free username for a Google sign-up.')
}

/** "Nguyễn.Văn-A+tag@gmail.com" → "nguyn.vna", or with a numeric suffix. */
async function availableUsername(email: string, forceSuffix: boolean): Promise<string> {
  let base = email
    .split('@')[0]
    .split('+')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24)
  if (base.length < 3) base = `user${base}`

  if (!forceSuffix && !(await User.exists({ username: base }))) return base

  for (let i = 0; i < 10; i += 1) {
    const candidate = `${base}${randomInt(1000, 10000)}`
    if (!(await User.exists({ username: candidate }))) return candidate
  }
  return `${base}${Date.now().toString(36)}`
}
