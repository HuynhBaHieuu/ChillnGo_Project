import { OAuth2Client } from 'google-auth-library'

import { env } from '../env.js'
import { HttpError } from './errors.js'

/** What ChillnGo needs from a Google account. */
export interface GoogleProfile {
  /** Google's stable, never-reused account id. */
  sub: string
  email: string
  name: string
  picture: string | null
}

let client: OAuth2Client | null = null

/**
 * Checks the ID token the Google button gave the browser: signed by Google,
 * issued for our client ID, not expired, and for a verified email.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!env.googleClientId) {
    throw new HttpError(503, 'Đăng nhập bằng Google chưa được cấu hình.', 'GOOGLE_NOT_CONFIGURED')
  }

  client ??= new OAuth2Client(env.googleClientId)

  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId })
    payload = ticket.getPayload()
  } catch {
    throw new HttpError(401, 'Không xác thực được tài khoản Google. Vui lòng thử lại.', 'GOOGLE_INVALID')
  }

  if (!payload?.sub || !payload.email) {
    throw new HttpError(401, 'Tài khoản Google không cung cấp email.', 'GOOGLE_INVALID')
  }
  // Linking by email is only safe when Google itself vouches for the address.
  if (!payload.email_verified) {
    throw new HttpError(403, 'Email của tài khoản Google này chưa được Google xác minh.', 'GOOGLE_EMAIL_UNVERIFIED')
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split('@')[0],
    picture: payload.picture ?? null,
  }
}
