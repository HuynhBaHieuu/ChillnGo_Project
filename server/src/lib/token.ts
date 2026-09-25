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
