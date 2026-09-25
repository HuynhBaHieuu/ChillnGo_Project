/**
 * Validated environment.
 *
 * Read once at startup so a missing secret fails loudly on boot (or in the
 * Vercel function log) instead of as a confusing error on the first request.
 */

import dotenv from 'dotenv'

import type { SignOptions } from 'jsonwebtoken'

dotenv.config({ quiet: true })

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See server/.env.example.`)
  }
  return value
}

const jwtSecret = required('JWT_SECRET')
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.')
}

const isVercel = Boolean(process.env.VERCEL)

/**
 * Outgoing mail. Configured when SMTP_USER and SMTP_PASS are set; the host
 * defaults to Gmail. Without it, local dev prints each email's link to the
 * console instead of sending, so sign-up still works before SMTP is set up.
 */
function readSmtp() {
  const user = process.env.SMTP_USER?.trim()
  const rawPass = process.env.SMTP_PASS?.trim()
  if (!user || !rawPass) return null

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT) || 465
  // Google shows app passwords in groups of four ("abcd efgh ..."); the spaces
  // are not part of the password.
  const pass = host === 'smtp.gmail.com' ? rawPass.replace(/\s+/g, '') : rawPass

  return { host, port, secure: port === 465, user, pass }
}

const smtp = readSmtp()
if (isVercel && !smtp) {
  throw new Error('SMTP_USER and SMTP_PASS are required on Vercel, or no verification email can be sent.')
}
if (isVercel && !process.env.APP_URL?.trim()) {
  throw new Error('APP_URL is required on Vercel: it is the web address the verification link opens.')
}

export const env = {
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN?.trim() || '7d') as NonNullable<SignOptions['expiresIn']>,
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  port: Number(process.env.PORT) || 4000,
  isVercel,
  /** The web app's address. Links in emails point here. */
  appUrl: (process.env.APP_URL?.trim() || 'http://localhost:5173').replace(/\/$/, ''),
  smtp,
  /**
   * OAuth client ID for "Sign in with Google". The same value goes in
   * web/.env.local as VITE_GOOGLE_CLIENT_ID. Unset disables Google sign-in.
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  mailFrom: process.env.MAIL_FROM?.trim() || `ChillnGo <${smtp?.user ?? 'no-reply@chillngo.local'}>`,
}
