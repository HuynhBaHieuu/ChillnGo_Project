import type { RequestHandler } from 'express'

import { HttpError } from '../lib/errors.js'
import { verifyToken } from '../lib/token.js'

/**
 * Accepts `Authorization: Bearer <token>` and puts the user id on
 * `res.locals.userId`. Anything else is a 401.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  const claims = scheme === 'Bearer' && token ? verifyToken(token) : null

  if (!claims) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')

  res.locals.userId = claims.sub
  next()
}
