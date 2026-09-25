import type { RequestHandler, Response } from 'express'

import { assertNotLocked } from '../lib/accountStatus.js'
import { HttpError } from '../lib/errors.js'
import { effectivePermissions, isStaff } from '../lib/permissions.js'
import type { AdminModule } from '../lib/permissions.js'
import { User } from '../models/User.js'
import type { UserDocument } from '../models/User.js'

/**
 * Loads the signed-in user from the database (after `requireAuth`).
 *
 * Role and lock status are read fresh on every request rather than trusted
 * from the token, so demoting or locking someone takes effect immediately.
 * A deleted or locked account gets 401, which signs the web client out.
 */
export const loadCurrentUser: RequestHandler = async (_req, res, next) => {
  const user = await User.findById(res.locals.userId as string)
  if (!user) throw new HttpError(401, 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.')
  try {
    assertNotLocked(user)
  } catch (error) {
    throw new HttpError(401, (error as Error).message, 'ACCOUNT_LOCKED')
  }
  res.locals.currentUser = user
  next()
}

export function currentUser(res: Response): UserDocument {
  return res.locals.currentUser as UserDocument
}

export const requireStaff: RequestHandler = (_req, res, next) => {
  if (!isStaff(currentUser(res).role)) throw new HttpError(403, 'Bạn không có quyền quản trị.', 'FORBIDDEN')
  next()
}

export const requireSuperAdmin: RequestHandler = (_req, res, next) => {
  if (currentUser(res).role !== 'superadmin') {
    throw new HttpError(403, 'Chỉ Super Admin mới làm được việc này.', 'FORBIDDEN')
  }
  next()
}

export function requirePermission(module: AdminModule): RequestHandler {
  return (_req, res, next) => {
    if (!effectivePermissions(currentUser(res)).includes(module)) {
      throw new HttpError(403, 'Bạn chưa được cấp quyền cho mục này.', 'FORBIDDEN')
    }
    next()
  }
}
