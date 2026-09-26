/**
 * Authentication, backed by the real API in `server/` (MongoDB).
 *
 * The rest of the app still reads mock data from `./client`, and those mock
 * services look users up in `db.users`. So every signed-in user is also
 * mirrored into that in-memory table; otherwise a newly registered account
 * would have no profile page and could not post or comment. The mirror goes
 * away once the other services move to the API.
 */

import { travelAvatar, travelBanner } from '@/lib/photos'
import { useAuthStore } from '@/store/auth.store'

import { clone, db } from './client'
import { http } from './http'
import type { AuthSession, Credentials, RegisterPayload, RegisterResult, User } from './types'

/**
 * The API stores an empty avatar/cover for new accounts; the web app decides
 * what the default looks like, using the same travel photos as the mock users.
 */
function withDefaultPhotos(user: User): User {
  return {
    ...user,
    avatarUrl: user.avatarUrl || travelAvatar(user.username),
    coverUrl: user.coverUrl || travelBanner(user.username),
  }
}

/** Insert or refresh the signed-in user in the mock `db.users` table. */
function mirrorIntoMockDb(user: User): void {
  const index = db.users.findIndex((u) => u._id === user._id)
  if (index === -1) db.users.push(clone(user))
  else db.users[index] = { ...db.users[index], ...clone(user) }
}

/**
 * Takes a user record fresh from the API (after a profile edit, say) and makes
 * it the one the app shows: default photos filled in, mock table refreshed.
 */
export function adoptUser(user: User): User {
  const shown = withDefaultPhotos(user)
  mirrorIntoMockDb(shown)
  return shown
}

function adopt(session: AuthSession): AuthSession {
  const user = withDefaultPhotos(session.user)
  mirrorIntoMockDb(user)
  return { token: session.token, user }
}

// A session restored from localStorage after a reload must be in the mock
// table before any page's first mock query reads it.
const restoredUser = useAuthStore.getState().user
if (restoredUser) mirrorIntoMockDb(restoredUser)

/** POST /api/auth/login */
export async function login(credentials: Credentials): Promise<AuthSession> {
  const session = await http<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: { email: credentials.email.trim(), password: credentials.password },
    auth: false,
  })
  return adopt(session)
}

/**
 * POST /api/auth/register — creates an unverified account and emails a
 * confirmation link. Does not sign in.
 */
export function register(payload: RegisterPayload): Promise<RegisterResult> {
  return http<RegisterResult>('/api/auth/register', {
    method: 'POST',
    body: {
      displayName: payload.displayName.trim(),
      username: payload.username.trim(),
      email: payload.email.trim(),
      password: payload.password,
    },
    auth: false,
  })
}

/**
 * POST /api/auth/google — signs in with the ID token from Google's button.
 * Creates the account on first use.
 */
export async function loginWithGoogle(credential: string): Promise<AuthSession> {
  const session = await http<AuthSession>('/api/auth/google', {
    method: 'POST',
    body: { credential },
    auth: false,
  })
  return adopt(session)
}

/**
 * POST /api/auth/verify-email — confirms the address with the token from the
 * emailed link and returns a session, so the user is signed in right away.
 */
export async function verifyEmail(token: string): Promise<AuthSession> {
  const session = await http<AuthSession>('/api/auth/verify-email', {
    method: 'POST',
    body: { token },
    auth: false,
  })
  return adopt(session)
}

/** POST /api/auth/resend-verification — sends a fresh confirmation link. */
export function resendVerification(email: string): Promise<{ message: string }> {
  return http<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: { email: email.trim() },
    auth: false,
  })
}

/**
 * GET /api/auth/me — re-reads the user behind the stored token.
 * Throws ApiError 401 when the token is expired or invalid.
 */
export async function getCurrentUser(): Promise<User> {
  const { user } = await http<{ user: User }>('/api/auth/me')
  const fresh = withDefaultPhotos(user)
  mirrorIntoMockDb(fresh)
  return fresh
}
