import { createHash, randomBytes } from 'node:crypto'

/** How long a verification link stays valid. */
export const VERIFY_TTL_HOURS = 24

/** Minimum gap between two verification emails to the same account. */
export const RESEND_COOLDOWN_MS = 60 * 1000

/** How long a password reset link stays valid. Short: the link can take over an account. */
export const RESET_TTL_MINUTES = 60

/** Minimum gap between two password reset emails to the same account. */
export const RESET_COOLDOWN_MS = 60 * 1000

/**
 * Only the SHA-256 of a token is stored. Someone who reads the database still
 * cannot build a working link from it.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A fresh single-use token: `token` goes in the email, `hash` in the database. */
function createToken(ttlMs: number) {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) }
}

export function createVerifyToken() {
  return createToken(VERIFY_TTL_HOURS * 60 * 60 * 1000)
}

export function createResetToken() {
  return createToken(RESET_TTL_MINUTES * 60 * 1000)
}

/**
 * True for a sign-in token issued before the password last changed, which no
 * longer counts. `issuedAt` is in whole seconds, so `changedAt` is compared at
 * that precision: the sign-in right after a reset can share its second.
 */
export function issuedBeforePasswordChange(issuedAt: number, changedAt: Date | null | undefined): boolean {
  return changedAt != null && issuedAt < Math.floor(changedAt.getTime() / 1000)
}
