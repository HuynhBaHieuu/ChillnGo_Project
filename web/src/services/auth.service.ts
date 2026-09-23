/**
 * Fake authentication.
 *
 * No password is ever checked and the token is a base64 blob, not a JWT — it
 * exists so the store, the guard and the navbar have something real-shaped to
 * pass around. Real auth lands with the Express API.
 */

import { travelAvatar, travelBanner } from '@/lib/photos'

import { ApiError, clone, db, delay, nextId, nowIso } from './client'
import type { AuthSession, Credentials, RegisterPayload, User } from './types'

/**
 * Base64 a UTF-8 string.
 *
 * `btoa` only accepts Latin-1, so passing it a display name with Vietnamese
 * diacritics throws `InvalidCharacterError`. Encoding to UTF-8 bytes first is
 * what real JWT libraries do, and what keeps "Trần Nhật Minh" from breaking
 * sign-in.
 */
function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Looks like a JWT (three dot-separated segments) but is not signed. */
function fakeToken(user: User): string {
  const header = base64Utf8(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64Utf8(
    JSON.stringify({
      sub: user._id,
      name: user.displayName,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    }),
  )
  return `${header}.${payload}.mock-signature`
}

/**
 * POST /api/auth/login.
 *
 * Any password works. An unknown email falls back to the seed account so the
 * demo never dead-ends on a typo.
 */
export async function login(credentials: Credentials): Promise<AuthSession> {
  await delay()

  const email = credentials.email.trim().toLowerCase()
  const user =
    db.users.find((u) => u.email.toLowerCase() === email) ??
    db.users.find((u) => u._id === 'u_001')

  if (!user) throw new ApiError('Không tìm thấy tài khoản', 401)

  return { token: fakeToken(user), user: clone(user) }
}

/** POST /api/auth/register — creates a real record in the in-memory db. */
export async function register(payload: RegisterPayload): Promise<AuthSession> {
  await delay()

  const email = payload.email.trim().toLowerCase()
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw new ApiError('Email này đã được đăng ký', 409)
  }

  const seed = payload.username || 'new-user'
  const user: User = {
    _id: nextId('u'),
    username: payload.username.trim(),
    displayName: payload.displayName.trim() || payload.username.trim(),
    email,
    avatarUrl: travelAvatar(seed),
    coverUrl: travelBanner(seed),
    bio: 'Thành viên mới của ChillnGo.',
    location: 'Việt Nam',
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    role: 'user',
    createdAt: nowIso(),
  }

  db.users.push(user)

  return { token: fakeToken(user), user: clone(user) }
}

/** GET /api/auth/me — re-reads the user behind a persisted token. */
export async function getCurrentUser(userId: string): Promise<User> {
  await delay()
  const user = db.users.find((u) => u._id === userId)
  if (!user) throw new ApiError('Phiên đăng nhập không hợp lệ', 401)
  return clone(user)
}
