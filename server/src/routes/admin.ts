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
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { tempPasswordMessage } from '../emails/tempPassword.js'
import { env } from '../env.js'
import { lockAccount } from '../lib/accountLock.js'
import { audit } from '../lib/audit.js'
import { HttpError, duplicateKeyField } from '../lib/errors.js'
import { sendMail } from '../lib/mailer.js'
import { ADMIN_MODULES, canManageAccount, effectivePermissions } from '../lib/permissions.js'
import { findTarget, hideTarget, removeTarget, unhideTarget } from '../lib/reportTargets.js'
import type { ReportTarget, TargetSnapshot } from '../lib/reportTargets.js'
import {
  REPORT_STATUSES,
  allowedActions,
  countReasons,
  hasModules,
  outcomeOf,
  requiredModules,
  resolveSchema,
  targetTypeSchema,
} from '../lib/reports.js'
import type { ReportTargetType, ResolveAction } from '../lib/reports.js'
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from '../lib/schemas.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  currentUser,
  loadCurrentUser,
  requirePermission,
  requireStaff,
  requireSuperAdmin,
} from '../middleware/staff.js'
import { AiDraft } from '../models/AiDraft.js'
import { AiUsage } from '../models/AiUsage.js'
import { AuditLog } from '../models/AuditLog.js'
import { CheckIn } from '../models/CheckIn.js'
import { countFollowsOf } from '../models/Follow.js'
import { Livestream } from '../models/Livestream.js'
import { notify } from '../models/Notification.js'
import { PostComment } from '../models/PostInteraction.js'
import { Report } from '../models/Report.js'
import { getSettings, Setting } from '../models/Setting.js'
import { TripPost } from '../models/TripPost.js'
import { User } from '../models/User.js'
import type { UserDocument } from '../models/User.js'

import { endStreamAsModerator } from './livestreams.js'

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

  const seesReports = effectivePermissions(actor).includes('reports')

  const [total, verified, locked, googleLinked, new7, new30, byDay, byRole, adminActions7, pendingReports] =
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
      // Pieces of content with reports waiting, not single reports.
      seesReports
        ? Report.aggregate<{ n: number }>([
            { $match: { status: 'pending' } },
            { $group: { _id: { t: '$targetType', i: '$targetId' } } },
            { $count: 'n' },
          ]).then((rows) => rows[0]?.n ?? 0)
        : Promise.resolve(null),
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
    content: await contentStats(new Date(now - 7 * DAY), since30),
    signupsByDay,
    ...(pendingReports !== null && { pendingReports }),
    ...(full && {
      byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
      adminActions7,
    }),
  })
})

/** Today in Vietnam, as AiUsage stores it. */
function vietnamDay(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** What people post and how the site is used: journeys, check-ins, streams, moderation, AI. */
async function contentStats(since7: Date, since30: Date) {
  const visiblePost = { status: 'published' as const, deletedAt: null }
  const moderated = { 'moderation.hidden': true }
  const [posts, posts7, checkins, checkins7, liveNow, streams30, hiddenPosts, hiddenCheckins, hiddenComments, reports7, aiToday, drafts7] =
    await Promise.all([
      TripPost.countDocuments(visiblePost),
      TripPost.countDocuments({ ...visiblePost, publishedAt: { $gte: since7 } }),
      CheckIn.countDocuments({ deletedAt: null }),
      CheckIn.countDocuments({ deletedAt: null, createdAt: { $gte: since7 } }),
      Livestream.countDocuments({ status: 'live' }),
      Livestream.countDocuments({ startedAt: { $gte: since30 } }),
      TripPost.countDocuments(moderated),
      CheckIn.countDocuments(moderated),
      PostComment.countDocuments(moderated),
      Report.countDocuments({ createdAt: { $gte: since7 } }),
      AiUsage.aggregate<{ requests: number; people: number }>([
        { $match: { day: vietnamDay() } },
        { $group: { _id: null, requests: { $sum: '$count' }, people: { $sum: 1 } } },
      ]).then((rows) => rows[0] ?? { requests: 0, people: 0 }),
      AiDraft.countDocuments({ createdAt: { $gte: since7 } }),
    ])
  return {
    posts,
    posts7,
    checkins,
    checkins7,
    liveNow,
    streams30,
    hidden: hiddenPosts + hiddenCheckins + hiddenComments,
    reports7,
    aiRequestsToday: aiToday.requests,
    aiUsersToday: aiToday.people,
    aiDrafts7: drafts7,
  }
}

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

/**
 * POST /api/admin/users/:id/lock { reason } — bans the account. Accounts are
 * never deleted: a ban is undone with /unlock.
 *
 * On top of refusing sign-in, a ban ends the stream they are hosting and takes
 * them out of other accounts' follower / following counts. Locking an account
 * that is already locked only changes the reason.
 */
adminRouter.post('/users/:id/lock', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const { reason } = lockSchema.parse(req.body ?? {})
  const target = await loadManageableTarget(req, actor)

  await lockAccount(target, reason)
  await audit(req, actor, 'user.lock', { id: target._id, label: label(target) }, { reason })

  res.json({ user: toAdminView(target) })
})

/** POST /api/admin/users/:id/unlock — lifts the ban; their follows count again. */
adminRouter.post('/users/:id/unlock', requirePermission('users'), async (req, res) => {
  const actor = currentUser(res)
  const target = await loadManageableTarget(req, actor)
  const wasLocked = target.status === 'locked'

  target.set({ status: 'active', lockedReason: '', lockedAt: undefined })
  await target.save()
  if (wasLocked) await countFollowsOf(target._id, true)
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

/* ---------------------------------------------------------------- reports */

const reportQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).catch('pending'),
  targetType: targetTypeSchema.optional().catch(undefined),
  page: pageSchema,
})

type PublicUser = { _id: string; username: string; displayName: string; avatarUrl: string; status: string; role: string }

async function usersById(ids: (string | null | undefined)[]): Promise<Map<string, PublicUser>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id) && id !== 'system'))]
  const users = await User.find({ _id: { $in: wanted } }).select('username displayName avatarUrl status role').lean()
  return new Map(users.map((u) => [String(u._id), { ...u, _id: String(u._id) } as PublicUser]))
}

/** What the queue shows about the content as it is now (it may be gone). */
function liveState(target: ReportTarget | null) {
  return target
    ? { exists: true, visible: target.visible, hidden: target.hidden, action: target.action, hiddenBy: target.hiddenBy }
    : { exists: false, visible: false, hidden: false, action: null, hiddenBy: null }
}

function parseTarget(req: Request) {
  const targetType = targetTypeSchema.parse(String(req.params.targetType))
  const targetId = String(req.params.targetId)
  if (!isValidObjectId(targetId)) throw new HttpError(404, 'Không tìm thấy nội dung này.', 'NOT_FOUND')
  return { targetType, targetId }
}

/**
 * GET /api/admin/reports?status&targetType&page — [reports]. Reports grouped
 * by what they are about: how many, why, when last, and a preview of the
 * content with its owner. Pending ones with the most reports come first.
 */
adminRouter.get('/reports', requirePermission('reports'), async (req, res) => {
  const query = reportQuerySchema.parse(req.query)
  const match: Record<string, unknown> = { status: query.status }
  if (query.targetType) match.targetType = query.targetType

  const [result] = await Report.aggregate<{
    items: {
      _id: { targetType: ReportTargetType; targetId: string }
      count: number
      reasons: string[]
      lastReportedAt: Date
      resolvedAt: Date | null
      targetOwnerId: string
      snapshot: TargetSnapshot
      action: string
      resolvedBy: string | null
    }[]
    total: { n: number }[]
  }>([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { targetType: '$targetType', targetId: '$targetId' },
        count: { $sum: 1 },
        reasons: { $push: '$reason' },
        lastReportedAt: { $max: '$createdAt' },
        resolvedAt: { $max: '$resolvedAt' },
        targetOwnerId: { $first: '$targetOwnerId' },
        snapshot: { $first: '$snapshot' },
        action: { $first: '$action' },
        resolvedBy: { $first: '$resolvedBy' },
      },
    },
    { $sort: query.status === 'pending' ? { count: -1, lastReportedAt: -1 } : { resolvedAt: -1, lastReportedAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (query.page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
        total: [{ $count: 'n' }],
      },
    },
  ])

  const groups = result?.items ?? []
  const [users, targets] = await Promise.all([
    usersById(groups.flatMap((g) => [g.targetOwnerId, g.resolvedBy])),
    Promise.all(groups.map((g) => findTarget(g._id.targetType, g._id.targetId))),
  ])

  res.json({
    items: groups.map((g, i) => ({
      targetType: g._id.targetType,
      targetId: g._id.targetId,
      count: g.count,
      reasons: countReasons(g.reasons),
      lastReportedAt: g.lastReportedAt.toISOString(),
      resolvedAt: g.resolvedAt ? g.resolvedAt.toISOString() : null,
      action: g.action,
      resolvedBy: g.resolvedBy ? (users.get(g.resolvedBy) ?? null) : null,
      snapshot: targets[i]?.snapshot ?? g.snapshot,
      owner: users.get(g.targetOwnerId) ?? null,
      target: liveState(targets[i]),
    })),
    total: result?.total[0]?.n ?? 0,
    page: query.page,
    pageSize: PAGE_SIZE,
  })
})

/** GET /api/admin/reports/target/:targetType/:targetId — [reports]. Every report about one piece of content. */
adminRouter.get('/reports/target/:targetType/:targetId', requirePermission('reports'), async (req, res) => {
  const { targetType, targetId } = parseTarget(req)
  const [reports, target] = await Promise.all([
    Report.find({ targetType, targetId }).sort({ createdAt: -1 }).limit(500).lean(),
    findTarget(targetType, targetId),
  ])
  if (reports.length === 0) throw new HttpError(404, 'Không có báo cáo nào về nội dung này.', 'NOT_FOUND')

  const ownerId = target?.ownerId ?? reports[0].targetOwnerId
  const users = await usersById([ownerId, ...reports.flatMap((r) => [r.reporterId, r.resolvedBy])])

  res.json({
    target: {
      targetType,
      targetId,
      snapshot: target?.snapshot ?? reports[0].snapshot,
      owner: users.get(ownerId) ?? null,
      ...liveState(target),
      pendingCount: reports.filter((r) => r.status === 'pending').length,
      reasons: countReasons(reports.filter((r) => r.status === 'pending').map((r) => r.reason)),
      allowedActions: allowedActions(targetType),
    },
    reports: reports.map((r) => ({
      _id: String(r._id),
      reporter: users.get(r.reporterId) ?? null,
      reason: r.reason,
      note: r.note,
      status: r.status,
      action: r.action,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolvedBy: r.resolvedBy ? (users.get(r.resolvedBy) ?? null) : null,
      resolutionNote: r.resolutionNote,
    })),
  })
})

/** What the owner is told, per decision. */
const OWNER_MESSAGES: Partial<Record<ResolveAction, string>> = {
  hide: 'Nội dung của bạn đã bị ẩn do vi phạm quy định cộng đồng.',
  remove: 'Nội dung của bạn đã bị gỡ do vi phạm quy định cộng đồng.',
  lock: 'Tài khoản của bạn đã bị khoá do vi phạm quy định cộng đồng.',
}
const REPORTER_RESOLVED = 'Cảm ơn bạn đã báo cáo. Nội dung bạn báo cáo đã được xử lý.'
const REPORTER_DISMISSED = 'Chúng tôi đã xem xét báo cáo của bạn và không thấy vi phạm. Cảm ơn bạn đã báo cáo.'

/**
 * POST /api/admin/reports/target/:targetType/:targetId/resolve { action, note? }
 * — [reports]; "lock" also needs [users]. Decides every pending report about
 * this content at once:
 *
 *   dismiss  no violation; content the system hid on its own is shown again
 *   hide     hidden until unhidden (POST /moderation/…/unhide)
 *   remove   a journey / check-in goes to "Recently Deleted" for good; a comment is deleted
 *   lock     locks the owner's account (as /users/:id/lock does) and hides the content
 *
 * The owner is notified (hide, remove, lock), and so is everyone who reported it.
 */
adminRouter.post('/reports/target/:targetType/:targetId/resolve', requirePermission('reports'), async (req, res) => {
  const actor = currentUser(res)
  const { targetType, targetId } = parseTarget(req)
  const { action, note } = resolveSchema.parse(req.body ?? {})

  if (!allowedActions(targetType).includes(action)) {
    throw new HttpError(400, 'Quyết định này không áp dụng cho loại nội dung này.', 'INVALID_ACTION')
  }
  if (!hasModules(effectivePermissions(actor), requiredModules(action))) {
    throw new HttpError(403, 'Bạn chưa được cấp quyền Người dùng để khoá tài khoản.', 'FORBIDDEN')
  }

  const pending = await Report.find({ targetType, targetId, status: 'pending' }).lean()
  if (pending.length === 0) {
    throw new HttpError(409, 'Không còn báo cáo nào chờ xử lý cho nội dung này.', 'NOTHING_PENDING')
  }
  const target = await findTarget(targetType, targetId)
  const reason = note || 'Vi phạm quy định cộng đồng'

  if (action === 'dismiss') {
    // The automatic hide was only until someone looked.
    if (target?.hidden && target.hiddenBy === 'system') await unhideTarget(targetType, targetId)
  } else if (action === 'hide' || action === 'remove') {
    if (!target) throw new HttpError(404, 'Nội dung này không còn tồn tại. Hãy chọn Bỏ qua.', 'NOT_FOUND')
    if (action === 'hide') await hideTarget(targetType, targetId, actor._id, reason)
    else await removeTarget(targetType, targetId, actor._id, reason)
  } else {
    const owner = await User.findById(target?.ownerId ?? pending[0].targetOwnerId)
    if (!owner) throw new HttpError(404, 'Không tìm thấy tài khoản của chủ nội dung.', 'NOT_FOUND')
    if (!canManageAccount(actor, owner)) {
      throw new HttpError(403, 'Bạn không thể khoá tài khoản này.', 'FORBIDDEN')
    }
    await lockAccount(owner, reason)
    await audit(req, actor, 'user.lock', { id: owner._id, label: label(owner) }, { reason, via: 'report' })
    if (target && targetType !== 'user' && !target.hidden) await hideTarget(targetType, targetId, actor._id, reason)
  }

  const outcome = outcomeOf(action)
  await Report.updateMany(
    { _id: { $in: pending.map((r) => r._id) } },
    { $set: { ...outcome, resolvedBy: actor._id, resolvedAt: new Date(), resolutionNote: note } },
  )

  const snapshot = target?.snapshot ?? pending[0].snapshot
  const ownerId = target?.ownerId ?? pending[0].targetOwnerId
  await audit(
    req,
    actor,
    `report.${action}`,
    { type: targetType, id: targetId, label: (snapshot?.title || snapshot?.text || targetId).slice(0, 120) },
    { reports: pending.length, ownerId, note },
  )

  const postId = targetType === 'post' ? targetId : targetType === 'comment' ? (snapshot?.postId ?? undefined) : undefined
  const ownerMessage = OWNER_MESSAGES[action]
  if (ownerMessage) await notify([ownerId], { type: 'moderation', actorId: null, message: ownerMessage, postId })
  await notify([...new Set(pending.map((r) => r.reporterId))], {
    type: 'report_resolved',
    actorId: null,
    message: action === 'dismiss' ? REPORTER_DISMISSED : REPORTER_RESOLVED,
  })

  res.json({ resolved: pending.length, ...outcome })
})

/* ------------------------------------------------------------- moderation */

const HIDDEN_TYPES = ['post', 'comment', 'checkin'] as const
type HiddenType = (typeof HIDDEN_TYPES)[number]

const hiddenQuerySchema = z.object({
  targetType: z.enum(HIDDEN_TYPES).catch('post'),
  page: pageSchema,
})

/** Ids of one page of moderated content of one type, newest first, and how many there are. */
async function hiddenPage(type: HiddenType, page: number): Promise<{ ids: string[]; total: number }> {
  const filter = { 'moderation.hidden': true }
  const sort = { 'moderation.at': -1 as const, _id: -1 as const }
  const skip = (page - 1) * PAGE_SIZE
  const [docs, total] =
    type === 'post'
      ? await Promise.all([TripPost.find(filter).sort(sort).skip(skip).limit(PAGE_SIZE).select('_id').lean(), TripPost.countDocuments(filter)])
      : type === 'checkin'
        ? await Promise.all([CheckIn.find(filter).sort(sort).skip(skip).limit(PAGE_SIZE).select('_id').lean(), CheckIn.countDocuments(filter)])
        : await Promise.all([PostComment.find(filter).sort(sort).skip(skip).limit(PAGE_SIZE).select('_id').lean(), PostComment.countDocuments(filter)])
  return { ids: docs.map((d) => String(d._id)), total }
}

/**
 * GET /api/admin/moderation?targetType&page — [content]. Content currently
 * hidden or removed by a moderator or by the automatic hide, whether or not
 * reports are still pending, so it can be reviewed and shown again.
 */
adminRouter.get('/moderation', requirePermission('content'), async (req, res) => {
  const query = hiddenQuerySchema.parse(req.query)
  const { ids, total } = await hiddenPage(query.targetType, query.page)
  const targets = (await Promise.all(ids.map((id) => findTarget(query.targetType, id)))).filter(
    (target): target is ReportTarget => target !== null,
  )
  const reasons = new Map(
    (await moderationDetails(query.targetType, ids)).map((d) => [d.id, d] as const),
  )
  const users = await usersById(targets.flatMap((target) => [target.ownerId, target.hiddenBy]))

  res.json({
    items: targets.map((target) => {
      const detail = reasons.get(target.id)
      return {
        targetType: target.type,
        targetId: target.id,
        snapshot: target.snapshot,
        owner: users.get(target.ownerId) ?? null,
        action: target.action ?? 'hide',
        reason: detail?.reason ?? '',
        hiddenAt: detail?.at ? detail.at.toISOString() : null,
        hiddenBySystem: target.hiddenBy === 'system',
        hiddenBy: target.hiddenBy && target.hiddenBy !== 'system' ? (users.get(target.hiddenBy) ?? null) : null,
      }
    }),
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
  })
})

/** The moderation reason and time, which findTarget does not carry. */
async function moderationDetails(type: HiddenType, ids: string[]): Promise<{ id: string; reason: string; at: Date | null }[]> {
  const filter = { _id: { $in: ids } }
  const docs =
    type === 'post'
      ? await TripPost.find(filter).select('moderation').lean()
      : type === 'checkin'
        ? await CheckIn.find(filter).select('moderation').lean()
        : await PostComment.find(filter).select('moderation').lean()
  return docs.map((d) => ({ id: String(d._id), reason: d.moderation?.reason ?? '', at: d.moderation?.at ?? null }))
}

/**
 * POST /api/admin/moderation/:targetType/:targetId/unhide — [content]. Shows
 * content hidden by a moderator or by the automatic hide again; removed
 * content also comes back out of "Recently Deleted".
 */
adminRouter.post('/moderation/:targetType/:targetId/unhide', requirePermission('content'), async (req, res) => {
  const actor = currentUser(res)
  const { targetType, targetId } = parseTarget(req)
  if (targetType === 'user') {
    throw new HttpError(400, 'Tài khoản không bị ẩn. Hãy mở khoá ở mục Người dùng.', 'INVALID_ACTION')
  }
  const target = await findTarget(targetType, targetId)
  if (!target) throw new HttpError(404, 'Không tìm thấy nội dung này.', 'NOT_FOUND')
  if (!target.hidden) throw new HttpError(400, 'Nội dung này đang không bị ẩn.', 'NOT_HIDDEN')

  await unhideTarget(targetType, targetId)
  await audit(
    req,
    actor,
    'content.unhide',
    { type: targetType, id: targetId, label: (target.snapshot.title || target.snapshot.text || targetId).slice(0, 120) },
    { previousAction: target.action },
  )
  res.json({ ok: true })
})

/* ------------------------------------------------------------ livestreams */

/**
 * GET /api/admin/livestreams — [content]. Every stream live right now, of any
 * audience, so a moderator can step in while it is on air.
 */
adminRouter.get('/livestreams', requirePermission('content'), async (_req, res) => {
  const streams = await Livestream.find({ status: 'live' }).sort({ startedAt: -1 }).limit(100).lean()
  const users = await usersById(streams.map((s) => s.hostId))
  res.json({
    items: streams.map((s) => ({
      _id: String(s._id),
      title: s.title,
      description: s.description,
      audience: s.audience,
      startedAt: s.startedAt.toISOString(),
      viewerCount: s.viewerCount,
      peakViewers: s.peakViewers,
      commentCount: s.commentCount,
      host: users.get(s.hostId) ?? null,
    })),
  })
})

const endStreamSchema = z.object({
  reason: z.string().trim().max(200, 'Lý do tối đa 200 ký tự').optional().default(''),
})

/**
 * POST /api/admin/livestreams/:id/end { reason } — [content]. Stops a live
 * stream for breaking the rules. The host is told why; the replay is kept, and
 * can be dealt with by locking the account if needed.
 */
adminRouter.post('/livestreams/:id/end', requirePermission('content'), async (req, res) => {
  const actor = currentUser(res)
  const { reason } = endStreamSchema.parse(req.body ?? {})
  const stream = await endStreamAsModerator(String(req.params.id))
  if (!stream) throw new HttpError(404, 'Buổi livestream này không còn đang phát.', 'NOT_LIVE')

  await audit(req, actor, 'livestream.end', { type: 'livestream', id: String(stream._id), label: stream.title.slice(0, 120) }, {
    reason,
    hostId: stream.hostId,
  })
  await notify([stream.hostId], {
    type: 'moderation',
    actorId: null,
    message: reason
      ? `Buổi livestream của bạn đã bị dừng do vi phạm quy định cộng đồng: ${reason}`
      : 'Buổi livestream của bạn đã bị dừng do vi phạm quy định cộng đồng.',
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
