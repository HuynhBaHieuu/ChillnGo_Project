/**
 * "Your Activity": things only the signed-in user may see about themselves.
 * Every route reads and writes the caller's own rows only; there is no way to
 * name another user.
 *
 *   GET    /api/activity/search-history          your searches, newest first
 *   POST   /api/activity/search-history          { type, query } → records (or bumps) one
 *   DELETE /api/activity/search-history/:id      remove one
 *   DELETE /api/activity/search-history          clear all
 *   GET    /api/activity/account-history         changes to your account, newest first
 *   GET    /api/activity/live-comments           comments you wrote in livestreams
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { HttpError } from '../lib/errors.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { AccountEvent } from '../models/AccountEvent.js'
import { Livestream, LivestreamComment } from '../models/Livestream.js'
import { SEARCH_HISTORY_LIMIT, SEARCH_TYPES, SearchHistory } from '../models/SearchHistory.js'
import { User } from '../models/User.js'

export const activityRouter = Router()
activityRouter.use(requireAuth, loadCurrentUser)

const searchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_req, res) => String(res.locals.userId),
  message: { message: 'Bạn tìm kiếm quá nhanh. Vui lòng đợi một chút.' },
})

/* --------------------------------------------------------- search history */

function searchView(row: { _id: unknown; type: string; query: string; searchedAt: Date }) {
  return { _id: String(row._id), type: row.type, query: row.query, searchedAt: row.searchedAt.toISOString() }
}

activityRouter.get('/search-history', async (_req, res) => {
  const rows = await SearchHistory.find({ userId: currentUser(res)._id })
    .sort({ searchedAt: -1 })
    .limit(SEARCH_HISTORY_LIMIT)
    .lean()
  res.json({ items: rows.map(searchView) })
})

const searchSchema = z.object({
  type: z.enum(SEARCH_TYPES, 'Loại tìm kiếm không hợp lệ'),
  query: z.string().trim().min(1, 'Nội dung tìm kiếm trống').max(120, 'Nội dung tìm kiếm quá dài'),
})

activityRouter.post('/search-history', searchLimiter, async (req, res) => {
  const { type, query } = searchSchema.parse(req.body)
  const userId = currentUser(res)._id

  const row = await SearchHistory.findOneAndUpdate(
    { userId, type, query },
    { $set: { searchedAt: new Date() } },
    { upsert: true, new: true },
  ).lean()

  // Keep only the newest SEARCH_HISTORY_LIMIT rows.
  const overflow = await SearchHistory.find({ userId })
    .sort({ searchedAt: -1 })
    .skip(SEARCH_HISTORY_LIMIT)
    .select('_id')
    .lean()
  if (overflow.length) await SearchHistory.deleteMany({ _id: { $in: overflow.map((o) => o._id) } })

  res.status(201).json({ item: searchView(row) })
})

activityRouter.delete('/search-history/:id', async (req, res) => {
  const id = String(req.params.id)
  // Scoped to the caller: someone else's id simply matches nothing.
  const result = isValidObjectId(id)
    ? await SearchHistory.deleteOne({ _id: id, userId: currentUser(res)._id })
    : { deletedCount: 0 }
  if (result.deletedCount === 0) throw new HttpError(404, 'Không tìm thấy mục tìm kiếm này.', 'NOT_FOUND')
  res.json({ ok: true })
})

activityRouter.delete('/search-history', async (_req, res) => {
  await SearchHistory.deleteMany({ userId: currentUser(res)._id })
  res.json({ ok: true })
})

/* -------------------------------------------------------- account history */

activityRouter.get('/account-history', async (_req, res) => {
  const user = currentUser(res)
  const rows = await AccountEvent.find({ userId: user._id }).sort({ createdAt: -1 }).limit(200).lean()
  const items = rows.map((r) => ({
    _id: String(r._id),
    type: r.type,
    details: r.details ?? {},
    createdAt: r.createdAt.toISOString(),
  }))

  // Accounts made before this history existed have no "account_created" row,
  // but the account's own creation time is a real, recorded fact.
  if (!items.some((i) => i.type === 'account_created')) {
    items.push({ _id: `created-${user._id}`, type: 'account_created', details: {}, createdAt: user.createdAt.toISOString() })
  }

  res.json({ items })
})

/* ---------------------------------------------------------- live comments */

activityRouter.get('/live-comments', async (_req, res) => {
  const user = currentUser(res)
  const comments = await LivestreamComment.find({ authorId: user._id }).sort({ createdAt: -1 }).limit(100).lean()

  const streamIds = [...new Set(comments.map((c) => c.livestreamId))]
  const streams = await Livestream.find({ _id: { $in: streamIds.filter((id) => isValidObjectId(id)) } })
    .select('title hostId status startedAt')
    .lean()
  const streamById = new Map(streams.map((s) => [String(s._id), s]))
  const hosts = await User.find({ _id: { $in: [...new Set(streams.map((s) => s.hostId))] } })
    .select('displayName username avatarUrl')
    .lean()
  const hostById = new Map(hosts.map((h) => [h._id, h]))

  res.json({
    items: comments.map((c) => {
      const stream = streamById.get(c.livestreamId)
      const host = stream ? hostById.get(stream.hostId) : undefined
      return {
        _id: String(c._id),
        text: c.text,
        createdAt: c.createdAt.toISOString(),
        livestream: stream
          ? {
              _id: String(stream._id),
              title: stream.title,
              status: stream.status,
              host: host
                ? { _id: host._id, displayName: host.displayName, username: host.username, avatarUrl: host.avatarUrl }
                : null,
            }
          : null,
      }
    }),
  })
})
