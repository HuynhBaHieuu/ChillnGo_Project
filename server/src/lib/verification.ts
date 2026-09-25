import { createHash, randomBytes } from 'node:crypto'

/** How long a verification link stays valid. */
export const VERIFY_TTL_HOURS = 24

/** Minimum gap between two verification emails to the same account. */
export const RESEND_COOLDOWN_MS = 60 * 1000

/**
 * Only the SHA-256 of a token is stored. Someone who reads the database still
 * cannot build a working link from it.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A fresh single-use token: `token` goes in the email, `hash` in the database. */
export function createVerifyToken() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000),
  }
}
