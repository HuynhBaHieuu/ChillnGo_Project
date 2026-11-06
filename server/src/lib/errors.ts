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

/** Where every error body points for the machine-readable description of the API. */
export const API_DOCS_PATH = '/api/openapi.json'

/** The code an error gets when the route that threw it did not name one. */
const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
}

/**
 * What a client (often an agent, not a person) can do about each status.
 * English on purpose: `message` is the Vietnamese text for the UI, `hint` is
 * for whoever is writing or running the client.
 */
const HINTS: Record<number, string> = {
  400: 'The request was malformed or failed validation. Fix the request body or query and retry.',
  401: 'Missing or expired credentials. Sign in with POST /api/auth/login and send the token as "Authorization: Bearer <token>".',
  403: 'The signed-in account is not allowed to do this. Do not retry with the same account.',
  404: 'No such resource or route. Check the path and id against the OpenAPI description.',
  409: 'The request conflicts with the current state of the resource. Fetch it again, then retry.',
  410: 'The resource existed but has been removed permanently.',
  413: 'The request body is too large. Send less data.',
  422: 'The request was well-formed but could not be processed. Check the field values.',
  429: 'Too many requests. Wait for the time in the RateLimit / Retry-After headers, then retry.',
  500: 'Unexpected server error. Retry later; report it if it keeps happening.',
  502: 'An upstream service failed. Retry later.',
  503: 'The service or one of its dependencies is temporarily unavailable. Retry after a short wait.',
}

export interface ErrorBody {
  /** Human-readable, shown in the UI as-is. */
  message: string
  /** Stable, machine-readable identifier. */
  code: string
  /** The HTTP status, repeated so the body stands on its own. */
  status: number
  /** What the client can do about it. */
  hint: string
  /** The OpenAPI description of every endpoint. */
  docs: string
  /** Field-level problems, for validation errors. */
  issues?: { path: string; message: string }[]
}

/** The JSON body of every error response the API sends. */
export function errorBody(
  status: number,
  message: string,
  code?: string,
  issues?: ErrorBody['issues'],
): ErrorBody {
  return {
    message,
    code: code ?? DEFAULT_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
    status,
    hint: HINTS[status] ?? (status >= 500 ? HINTS[500] : HINTS[400]),
    docs: API_DOCS_PATH,
    ...(issues && issues.length > 0 && { issues }),
  }
}

/** The `message` option of an express-rate-limit limiter, in the shared error shape. */
export function rateLimitBody(message: string, code?: string): ErrorBody {
  return errorBody(429, message, code ?? 'RATE_LIMITED')
}

/** Field name behind MongoDB's duplicate-key error, or null for other errors. */
export function duplicateKeyField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const { code, keyPattern } = error as { code?: number; keyPattern?: Record<string, unknown> }
  if (code !== 11000) return null
  return Object.keys(keyPattern ?? {})[0] ?? 'unknown'
}

/** Every error response is JSON in the shape of `errorBody()`. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(errorBody(error.status, error.message, error.code))
    return
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    res
      .status(400)
      .json(errorBody(400, error.issues[0]?.message ?? 'Dữ liệu không hợp lệ', 'VALIDATION_FAILED', issues))
    return
  }

  // Malformed JSON body, thrown by express.json().
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json(errorBody(400, 'Dữ liệu gửi lên không đúng định dạng JSON', 'INVALID_JSON'))
    return
  }

  // A body over the parser's limit (express.json({ limit })): the client's fault, not a server error.
  if ((error as { type?: string }).type === 'entity.too.large') {
    res
      .status(413)
      .json(errorBody(413, 'Dữ liệu gửi lên quá lớn. Hãy rút gọn nội dung rồi thử lại.', 'PAYLOAD_TOO_LARGE'))
    return
  }

  console.error(error)
  res.status(500).json(errorBody(500, 'Máy chủ gặp lỗi. Vui lòng thử lại sau.'))
}
