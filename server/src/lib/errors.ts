import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

/**
 * Any error the client should see. `message` is shown in the UI as-is;
 * `code` is a stable identifier for errors the client reacts to, such as
 * EMAIL_NOT_VERIFIED.
 */
export class HttpError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** Field name behind MongoDB's duplicate-key error, or null for other errors. */
export function duplicateKeyField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const { code, keyPattern } = error as { code?: number; keyPattern?: Record<string, unknown> }
  if (code !== 11000) return null
  return Object.keys(keyPattern ?? {})[0] ?? 'unknown'
}

/** Every error response has the shape `{ message }`. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, ...(error.code && { code: error.code }) })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({ message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' })
    return
  }

  // Malformed JSON body, thrown by express.json().
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Dữ liệu gửi lên không đúng định dạng JSON' })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' })
}
