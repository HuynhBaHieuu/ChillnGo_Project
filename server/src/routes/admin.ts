/**
 * /api/admin — back office for admins and the superadmin.
 *
 * Every route needs a signed-in, unlocked staff account. On top of that each
 * route needs either a module permission (admins) or the superadmin role.
 * The rules themselves live in lib/permissions.ts. Every change is written to
 * the audit log.
 */

import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { Router } from 'express'
import type { Request } from 'express'
import { z } from 'zod'

import { tempPasswordMessage } from '../emails/tempPassword.js'
import { env } from '../env.js'
import { audit } from '../lib/audit.js'
import { HttpError, duplicateKeyField } from '../lib/errors.js'
import { sendMail } from '../lib/mailer.js'
import { ADMIN_MODULES, canManageAccount, effectivePermissions } from '../lib/permissions.js'
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from '../lib/schemas.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  currentUser,
  loadCurrentUser,
  requirePermission,
  requireStaff,
  requireSuperAdmin,
} from '../middleware/staff.js'
import { AuditLog } from '../models/AuditLog.js'
import { getSettings, Setting } from '../models/Setting.js'
import { User } from '../models/User.js'
import type { UserDocument } from '../models/User.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, loadCurrentUser, requireStaff)

const PAGE_SIZE = 20

/* ---------------------------------------------------------------- helpers */

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1)

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** What the admin screens show for an account. Never includes secrets. */
function toAdminView(user: UserDocument) {
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    permissions: effectivePermissions(user),
    status: user.status,
    lockedReason: user.lockedReason,
    lockedAt: user.lockedAt?.toISOString() ?? null,
    emailVerified: user.emailVerified,
    googleLinked: Boolean(user.googleId),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

function label(user: { displayName: string; username: string }): string {
  return `${user.displayName} (@${user.username})`
}

/** Loads the target account and checks the current user may act on it. */
async function loadManageableTarget(req: Request, actor: UserDocument): Promise<UserDocument> {
  const target = await User.findById(String(req.params.id))
  if (!target) throw new HttpError(404, 'Không tìm thấy tài khoản.', 'NOT_FOUND')
  if (!canManageAccount(actor, target)) {
    const message =
      target.role === 'superadmin'
        ? 'Không thể thao tác trên tài khoản Super Admin.'
        : actor._id === target._id
          ? 'Bạn không thể thao tác trên chính tài khoản của mình.'
          : 'Bạn chỉ quản lý được tài khoản người dùng thường.'
    throw new HttpError(403, message, 'FORBIDDEN')
  }
  return target
}

/** A random password that satisfies the password policy. */
function temporaryPassword(): string {
  return `Cg-${randomBytes(6).toString('base64url')}7!`
}

/* ------------------------------------------------------------------ stats */

/**
 * GET /api/admin/stats — account statistics.
 *
 * Admins see regular users only. The superadmin also sees staff counts and
 * admin activity.
 */
adminRouter.get('/stats', requirePermission('stats'), async (_req, res) => {
  const actor = currentUser(res)
  const full = actor.role === 'superadmin'
  const scope: { role?: 'user' } = full ? {} : { role: 'user' }

  const DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const since30 = new Date(now - 29 * DAY)
  since30.setHours(0, 0, 0, 0)

  const [total, verified, locked, googleLinked, new7, new30, byDay, byRole, adminActions7] =
    await Promise.all([
      User.countDocuments(scope),
      User.countDocuments({ ...scope, emailVerified: true }),
      User.countDocuments({ ...scope, status: 'locked' }),
      User.countDocuments({ ...scope, googleId: { $exists: true, $ne: null } }),
      User.countDocuments({ ...scope, createdAt: { $gte: new Date(now - 7 * DAY) } }),
      User.countDocuments({ ...scope, createdAt: { $gte: since30 } }),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { ...scope, createdAt: { $gte: since30 } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      full
        ? User.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$role', count: { $sum: 1 } } }])
        : Promise.resolve([]),
      full ? AuditLog.countDocuments({ createdAt: { $gte: new Date(now - 7 * DAY) } }) : Promise.resolve(0),
    ])

  // One entry per day for the last 30 days, zeros included.
  const counts = new Map(byDay.map((d) => [d._id, d.count]))
  const signupsByDay = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(since30.getTime() + i * DAY)
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(day)
    return { date: key, count: counts.get(key) ?? 0 }
  })

  res.json({
    scope: full ? 'full' : 'users',
    users: { total, verified, locked, googleLinked, new7, new30 },
    signupsByDay,
    ...(full && {
      byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
      adminActions7,
    }),
  })
})

/* ------------------------------------------------------------------ users */

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(['user', 'admin', 'superadmin']).optional().catch(undefined),
  status: z.enum(['active', 'locked']).optional().catch(undefined),
  page: pageSchema,
})

/** GET /api/admin/users?q&role&status&page — admins only ever see role "user". */
adminRouter.get('/users', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const query = listQuerySchema.parse(req.query)

  const filter: Record<string, unknown> = {}
  if (actor.role !== 'superadmin') filter.role = 'user'
  else if (query.role) filter.role = query.role
  if (query.status) filter.status = query.status
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ username: pattern }, { displayName: pattern }, { email: pattern }]
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    User.countDocuments(filter),
  ])

  res.json({ items: items.map(toAdminView), total, page: query.page, pageSize: PAGE_SIZE })
})

const lockSchema = z.object({
  reason: z.string().trim().max(200, 'Lý do tối đa 200 ký tự').optional().default(''),
})

/** POST /api/admin/users/:id/lock { reason } */
adminRouter.post('/users/:id/lock', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const { reason } = lockSchema.parse(req.body ?? {})
  const target = await loadManageableTarget(req, actor)

  target.set({ status: 'locked', lockedReason: reason, lockedAt: new Date() })
  await target.save()
  await audit(req, actor, 'user.lock', { id: target._id, label: label(target) }, { reason })

  res.json({ user: toAdminView(target) })
})

/** POST /api/admin/users/:id/unlock */
adminRouter.post('/users/:id/unlock', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const target = await loadManageableTarget(req, actor)

  target.set({ status: 'active', lockedReason: '', lockedAt: undefined })
  await target.save()
  await audit(req, actor, 'user.unlock', { id: target._id, label: label(target) })

  res.json({ user: toAdminView(target) })
})

/**
 * POST /api/admin/users/:id/reset-password
 *
 * Sets a random temporary password and emails it to the account owner. The
 * admin never sees it.
 */
adminRouter.post('/users/:id/reset-password', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const target = await loadManageableTarget(req, actor)

  const tempPassword = temporaryPassword()
  target.set({ passwordHash: await bcrypt.hash(tempPassword, 10) })
  await target.save()
  await audit(req, actor, 'user.reset_password', { id: target._id, label: label(target) })

  try {
    await sendMail(
      tempPasswordMessage({
        to: target.email,
        displayName: target.displayName,
        username: target.username,
        tempPassword,
        loginUrl: `${env.appUrl}/login`,
      }),
    )
  } catch (error) {
    console.error('Could not send temporary password email:', error)
    throw new HttpError(
      502,
      'Đã đặt mật khẩu mới nhưng không gửi được email. Hãy thử đặt lại lần nữa.',
      'MAIL_FAILED',
    )
  }

  res.json({ message: `Đã gửi mật khẩu tạm thời tới ${target.email}.` })
})

/** DELETE /api/admin/users/:id — superadmin only. */
adminRouter.delete('/users/:id', requireSuperAdmin, async (req, res) => {
  const actor = currentUser(res)
  const target = await loadManageableTarget(req, actor)

  await target.deleteOne()
  await audit(req, actor, 'user.delete', { id: target._id, label: label(target) }, {
    email: target.email,
    role: target.role,
  })

  res.json({ ok: true })
})

/* ----------------------------------------------------------------- admins */

const permissionsSchema = z
  .array(z.enum(ADMIN_MODULES, 'Quyền không hợp lệ'))
  .max(ADMIN_MODULES.length)
  .transform((list) => [...new Set(list)])

const createAdminSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  permissions: permissionsSchema.default([]),
})

/** POST /api/admin/admins — create a new admin account. Superadmin only. */
adminRouter.post('/admins', requireSuperAdmin, async (req, res) => {
  const actor = currentUser(res)
  const input = createAdminSchema.parse(req.body)

  let admin
  try {
    admin = await User.create({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: 'admin',
      adminPermissions: input.permissions,
      emailVerified: true,
    })
  } catch (error) {
    const field = duplicateKeyField(error)
    if (field === 'email') throw new HttpError(409, 'Email này đã được dùng cho tài khoản khác.')
    if (field === 'username') throw new HttpError(409, 'Tên người dùng này đã có người dùng.')
    throw error
  }

  await audit(req, actor, 'admin.create', { id: admin._id, label: label(admin) }, {
    permissions: input.permissions,
  })
  res.status(201).json({ user: toAdminView(admin) })
})

const roleSchema = z.object({
  role: z.enum(['user', 'admin'], 'Vai trò không hợp lệ'),
  permissions: permissionsSchema.optional(),
})

/**
 * PATCH /api/admin/users/:id/role { role, permissions? } — promote a user to
 * admin or demote an admin to user. Superadmin only.
 */
adminRouter.patch('/users/:id/role', requireSuperAdmin, async (req, res) => {
  const actor = currentUser(res)
  const input = roleSchema.parse(req.body)
  const target = await loadManageableTarget(req, actor)
  const before = { role: target.role, permissions: effectivePermissions(target) }

  target.set({
    role: input.role,
    adminPermissions: input.role === 'admin' ? (input.permissions ?? target.adminPermissions) : [],
  })
  await target.save()
  await audit(req, actor, 'user.role', { id: target._id, label: label(target) }, {
    before,
    after: { role: target.role, permissions: effectivePermissions(target) },
  })

  res.json({ user: toAdminView(target) })
})

/** PATCH /api/admin/admins/:id/permissions { permissions } — superadmin only. */
adminRouter.patch('/admins/:id/permissions', requireSuperAdmin, async (req, res) => {
  const actor = currentUser(res)
  const permissions = permissionsSchema.parse(req.body?.permissions)
  const target = await loadManageableTarget(req, actor)
  if (target.role !== 'admin') throw new HttpError(400, 'Tài khoản này không phải Admin.')

  const before = effectivePermissions(target)
  target.set({ adminPermissions: permissions })
  await target.save()
  await audit(req, actor, 'admin.permissions', { id: target._id, label: label(target) }, {
    before,
    after: permissions,
  })

  res.json({ user: toAdminView(target) })
})

/* -------------------------------------------------------------- audit log */

const auditQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  action: z.string().trim().max(50).optional().catch(undefined),
  page: pageSchema,
})

/** GET /api/admin/audit-logs?q&action&page — superadmin only. */
adminRouter.get('/audit-logs', requireSuperAdmin, async (req, res) => {
  const query = auditQuerySchema.parse(req.query)

  const filter: Record<string, unknown> = {}
  if (query.action) filter.action = query.action
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ actorName: pattern }, { targetLabel: pattern }]
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    AuditLog.countDocuments(filter),
  ])

  res.json({
    items: items.map((log) => ({
      _id: String(log._id),
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      targetLabel: log.targetLabel,
      details: log.details ?? {},
      ip: log.ip,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
  })
})

/* --------------------------------------------------------------- settings */

const settingsSchema = z.object({
  registrationOpen: z.boolean('Giá trị không hợp lệ'),
  announcement: z.string('Giá trị không hợp lệ').trim().max(280, 'Thông báo tối đa 280 ký tự'),
})

/** GET /api/admin/settings — superadmin only. */
adminRouter.get('/settings', requireSuperAdmin, async (_req, res) => {
  res.json({ settings: await getSettings() })
})

/** PUT /api/admin/settings — superadmin only. */
adminRouter.put('/settings', requireSuperAdmin, async (req, res) => {
  const actor = currentUser(res)
  const next = settingsSchema.parse(req.body)
  const before = await getSettings()

  await Setting.updateOne({ _id: 'app' }, { $set: next }, { upsert: true })
  await audit(req, actor, 'settings.update', { type: 'settings', label: 'Cấu hình hệ thống' }, {
    before,
    after: next,
  })

  res.json({ settings: next })
})
