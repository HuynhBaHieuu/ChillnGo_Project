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

/**
 * Cloudinary account for profile images. Either CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@CLOUD_NAME, as shown on the Cloudinary
 * dashboard) or the three separate variables. Unset: image changes answer 503,
 * everything else on the profile still saves.
 */
function readCloudinary() {
  const url = process.env.CLOUDINARY_URL?.trim()
  const match = url?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/)
  if (match) return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null
}

/**
 * LiveKit, the realtime video service behind livestreams. LIVEKIT_URL is the
 * wss:// address from the LiveKit project settings. Unset: livestream routes
 * answer 503 and the Newsfeed simply shows no live cards.
 */
function readLiveKit() {
  const url = process.env.LIVEKIT_URL?.trim()
  const apiKey = process.env.LIVEKIT_API_KEY?.trim()
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim()
  if (!url || !apiKey || !apiSecret) return null
  // The server API speaks HTTP on the same host the browsers reach over WebSocket.
  const httpUrl = url.replace(/^ws(s?):\/\//, 'http$1://')
  return { url, httpUrl, apiKey, apiSecret }
}

/**
 * Where livestream recordings are uploaded: any S3-compatible bucket
 * (Backblaze B2, Cloudflare R2, AWS S3…). LiveKit records the room and
 * uploads the MP4 itself. The bucket stays private: each allowed viewer gets
 * a short-lived signed link to the replay. Unset: no recording option.
 */
function readRecording() {
  const bucket = process.env.RECORDING_S3_BUCKET?.trim()
  const accessKey = process.env.RECORDING_S3_ACCESS_KEY?.trim()
  const secret = process.env.RECORDING_S3_SECRET?.trim()
  if (!bucket || !accessKey || !secret) return null
  return {
    bucket,
    accessKey,
    secret,
    /** Blank for AWS S3; the provider's S3 endpoint otherwise (B2, R2…). */
    endpoint: process.env.RECORDING_S3_ENDPOINT?.trim() || '',
    /** The bucket's region: e.g. us-east-005 on B2, auto on R2. */
    region: process.env.RECORDING_S3_REGION?.trim() || 'auto',
  }
}

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
  cloudinary: readCloudinary(),
  livekit: readLiveKit(),
  recording: readRecording(),
  /**
   * Model the AI travel assistant asks through LiveKit Inference, as
   * "provider/model" (see LiveKit Inference's model list).
   */
  assistantModel: process.env.ASSISTANT_MODEL?.trim() || 'google/gemini-2.5-flash',
  /** Log each lookup the assistant makes (tool, arguments, result size). Off unless ASSISTANT_DEBUG=1. */
  assistantDebug: process.env.ASSISTANT_DEBUG === '1',
  /**
   * Google Gemini, asked first by AI clone. When it fails or its quota runs out,
   * AI clone falls back to LiveKit Inference (with ASSISTANT_MODEL). Unset: LiveKit only.
   */
  gemini: process.env.GEMINI_API_KEY?.trim()
    ? { apiKey: process.env.GEMINI_API_KEY.trim(), model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash' }
    : null,
  /** AI requests (an AI clone, a chat message) each user may make per day. */
  aiDailyLimit: Number(process.env.AI_DAILY_LIMIT_PER_USER) || 20,
  mailFrom: process.env.MAIL_FROM?.trim() || `ChillnGo <${smtp?.user ?? 'no-reply@chillngo.local'}>`,
}
