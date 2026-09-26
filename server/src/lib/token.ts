import { createHmac } from 'node:crypto'

import jwt from 'jsonwebtoken'

import { env } from '../env.js'

interface TokenClaims {
  sub: string
  role: string
}

export function signToken(user: { _id: string; role: string }): string {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user._id,
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  })
}

/** Returns the claims, or null for a missing, forged or expired token. */
export function verifyToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return null
    return { sub: payload.sub, role: String(payload.role ?? 'user') }
  } catch {
    return null
  }
}

/*
 * Livestream rewind (DVR) links. The playlist URL has to carry its own proof
 * of access (video players cannot send an Authorization header), so it gets
 * a short-lived token of its own. It is signed with a key derived from
 * JWT_SECRET, never JWT_SECRET itself: a rewind link must never work as a
 * sign-in token, and a sign-in token never as a rewind link.
 */
const dvrKey = createHmac('sha256', env.jwtSecret).update('chillngo:livestream-dvr').digest()

export function signDvrAccess(userId: string, streamId: string): string {
  return jwt.sign({ sid: streamId }, dvrKey, { subject: userId, expiresIn: '6h', algorithm: 'HS256' })
}

export function verifyDvrAccess(token: string): { userId: string; streamId: string } | null {
  try {
    const payload = jwt.verify(token, dvrKey, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null
    return { userId: payload.sub, streamId: payload.sid }
  } catch {
    return null
  }
}
