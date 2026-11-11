/**
 * /api/admin/news — [news]. Sources, the review queue, published news, run
 * history and the news worker's key. Every change is written to the audit log.
 *
 *   GET    /sources                     every source with its last run
 *   POST   /sources                     add a source → 201
 *   PUT    /sources/:id                 replace a source
 *   DELETE /sources/:id                 delete a source (its items stay)
 *   POST   /sources/preview             fetch a server-side source without saving: its first items
 *   POST   /sources/:id/run             fetch one server-side source now, then the AI step
 *   POST   /run                         fetch every enabled server-side source now
 *   GET    /items?status&sourceId&q&page   items by status
 *   GET    /items/:id                   one item in any status, with its post
 *   PATCH  /items/:id                   edit headline, summary, paragraphs, pictures, regions, destinations, pinned
 *   POST   /items/:id/rewrite           the AI reads the original again and writes the post anew
 *   POST   /items/:id/review            approve | reject | hide | unhide
 *   POST   /items/review                the same for many items
 *   GET    /runs?page                   fetch history, newest first
 *   GET    /worker                      whether a worker key exists and when the worker last called
 *   POST   /worker/key                  a new worker key (shown once); the old one stops working
 *   DELETE /worker/key                  revoke the worker key
 */

import { Router } from 'express'
import type { Request } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { audit } from '../lib/audit.js'
import { HttpError } from '../lib/errors.js'
import { enrichQueued, fetchSource, rewriteItem, rotateWorkerKey, revokeWorkerKey, runDueSources, runSource } from '../lib/news/pipeline.js'
import {
  REVIEW_TRANSITIONS,
  bulkReviewSchema,
  itemPatchSchema,
  itemView,
  previewSchema,
  reviewActionSchema,
  sourceInputSchema,
  sourceView,
} from '../lib/news/views.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser, requirePermission, requireStaff } from '../middleware/staff.js'
import { NEWS_STATUSES, NewsItem, NewsRun, NewsSource, NewsWorker } from '../models/News.js'

export const adminNewsRouter = Router()
adminNewsRouter.use(requireAuth, loadCurrentUser, requireStaff, requirePermission('news'))

const PAGE_SIZE = 20
const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1)

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function loadSource(req: Request) {
  const id = String(req.params.id)
  const source = isValidObjectId(id) ? await NewsSource.findById(id) : null
  if (!source) throw new HttpError(404, 'Không tìm thấy nguồn.', 'NOT_FOUND')
  return source
}

/* --------------------------------------------------------------- sources */

adminNewsRouter.get('/sources', async (_req, res) => {
  const sources = await NewsSource.find().sort({ createdAt: -1 })
  const counts = await NewsItem.aggregate<{ _id: { s: string; st: string }; n: number }>([
    { $group: { _id: { s: '$sourceId', st: '$status' }, n: { $sum: 1 } } },
  ])
  const bySource = new Map<string, Record<string, number>>()
  for (const c of counts) bySource.set(c._id.s, { ...(bySource.get(c._id.s) ?? {}), [c._id.st]: c.n })
  res.json({
    items: sources.map((s) => ({ ...sourceView(s), counts: bySource.get(String(s._id)) ?? {} })),
  })
})

adminNewsRouter.post('/sources', async (req, res) => {
  const input = sourceInputSchema.parse(req.body)
  const actor = currentUser(res)
  const source = await NewsSource.create({ ...input, createdBy: actor._id })
  await audit(req, actor, 'news.source.create', { type: 'news_source', id: String(source._id), label: source.name }, { type: source.type })
  res.status(201).json({ source: sourceView(source) })
})

adminNewsRouter.put('/sources/:id', async (req, res) => {
  const input = sourceInputSchema.parse(req.body)
  const source = await loadSource(req)
  source.set(input)
  await source.save()
  await audit(req, currentUser(res), 'news.source.update', { type: 'news_source', id: String(source._id), label: source.name })
  res.json({ source: sourceView(source) })
})

adminNewsRouter.delete('/sources/:id', async (req, res) => {
  const source = await loadSource(req)
  await source.deleteOne()
  await audit(req, currentUser(res), 'news.source.delete', { type: 'news_source', id: String(source._id), label: source.name })
  res.json({ ok: true })
})

adminNewsRouter.post('/sources/preview', async (req, res) => {
  const input = previewSchema.parse(req.body)
  try {
    const items = await fetchSource(input)
    res.json({
      items: items.slice(0, 5).map((i) => ({
        url: i.url,
        title: i.title,
        excerpt: i.excerpt.slice(0, 200),
        imageUrl: i.imageUrl,
        publishedAt: i.publishedAt.toISOString(),
        kind: i.kind,
      })),
      total: items.length,
    })
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, (error as Error).message, 'SOURCE_UNREADABLE')
  }
})

adminNewsRouter.post('/sources/:id/run', async (req, res) => {
  const source = await loadSource(req)
  if (source.type === 'social') {
    throw new HttpError(400, 'Nguồn mạng xã hội được cào bằng máy cào, không chạy trên máy chủ.', 'WORKER_SOURCE')
  }
  const result = await runSource(source, 'manual')
  const enriched = await enrichQueued()
  await audit(req, currentUser(res), 'news.source.run', { type: 'news_source', id: String(source._id), label: source.name })
  res.json({ result, enriched, source: sourceView(source) })
})

adminNewsRouter.post('/run', async (req, res) => {
  const result = await runDueSources('manual')
  await audit(req, currentUser(res), 'news.run_all', { type: 'news_source', label: 'Tất cả nguồn' }, { sources: result.sources.length })
  res.json(result)
})

/* ----------------------------------------------------------------- items */

const itemListSchema = z.object({
  status: z.enum(NEWS_STATUSES).optional().catch(undefined),
  sourceId: z.string().regex(/^[a-f0-9]{24}$/).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: pageSchema,
})

adminNewsRouter.get('/items', async (req, res) => {
  const query = itemListSchema.parse(req.query)
  const filter: Record<string, unknown> = {}
  if (query.status) filter.status = query.status
  if (query.sourceId) filter.sourceId = query.sourceId
  if (query.q) {
    const q = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ title: q }, { headline: q }]
  }
  const [items, total] = await Promise.all([
    NewsItem.find(filter)
      .sort(query.status === 'published' ? { pinned: -1, publishedAt: -1 } : { createdAt: -1 })
      .skip((query.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    NewsItem.countDocuments(filter),
  ])
  res.json({ items: items.map((i) => itemView(i, { admin: true })), total, page: query.page, pageSize: PAGE_SIZE })
})

async function loadItem(id: string) {
  const item = isValidObjectId(id) ? await NewsItem.findById(id) : null
  if (!item) throw new HttpError(404, 'Không tìm thấy tin.', 'NOT_FOUND')
  return item
}

adminNewsRouter.get('/items/:id', async (req, res) => {
  res.json({ item: itemView(await loadItem(String(req.params.id)), { admin: true }) })
})

adminNewsRouter.post('/items/:id/rewrite', async (req, res) => {
  const item = await loadItem(String(req.params.id))
  await rewriteItem(item)
  await audit(req, currentUser(res), 'news.item.rewrite', { type: 'news_item', id: String(item._id), label: item.title.slice(0, 120) })
  res.json({ item: itemView(item, { admin: true }) })
})

adminNewsRouter.patch('/items/:id', async (req, res) => {
  const input = itemPatchSchema.parse(req.body)
  const item = await loadItem(String(req.params.id))
  item.set(input)
  // The cover is the first picture.
  if (input.images) item.imageUrl = input.images[0] ?? ''
  await item.save()
  await audit(req, currentUser(res), input.pinned === undefined ? 'news.item.edit' : input.pinned ? 'news.item.pin' : 'news.item.unpin', {
    type: 'news_item',
    id: String(item._id),
    label: item.title.slice(0, 120),
  })
  res.json({ item: itemView(item, { admin: true }) })
})

async function review(req: Request, ids: string[], action: keyof typeof REVIEW_TRANSITIONS, reason: string) {
  const actor = currentUser(req.res!)
  const rule = REVIEW_TRANSITIONS[action]
  const result = await NewsItem.updateMany(
    { _id: { $in: ids }, status: { $in: rule.from } },
    {
      $set: {
        status: rule.to,
        statusReason: action === 'reject' || action === 'hide' ? reason : '',
        reviewedBy: actor._id,
        reviewedAt: new Date(),
        ...(action !== 'approve' && action !== 'unhide' ? { pinned: false } : {}),
      },
    },
  )
  await audit(req, actor, `news.item.${action}`, { type: 'news_item', id: ids.length === 1 ? ids[0] : '', label: `${ids.length} tin` }, { reason })
  return result.modifiedCount
}

adminNewsRouter.post('/items/review', async (req, res) => {
  const { ids, action, reason } = bulkReviewSchema.parse(req.body)
  res.json({ updated: await review(req, ids, action, reason) })
})

adminNewsRouter.post('/items/:id/review', async (req, res) => {
  const { action, reason } = reviewActionSchema.parse(req.body)
  const item = await loadItem(String(req.params.id))
  const updated = await review(req, [String(item._id)], action, reason)
  if (updated === 0) throw new HttpError(409, 'Trạng thái tin đã thay đổi. Hãy tải lại danh sách.', 'INVALID_STATE')
  res.json({ item: itemView((await NewsItem.findById(item._id))!, { admin: true }) })
})

/* ------------------------------------------------------------------ runs */

adminNewsRouter.get('/runs', async (req, res) => {
  const page = pageSchema.parse(req.query.page)
  const [items, total] = await Promise.all([
    NewsRun.find().sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    NewsRun.countDocuments(),
  ])
  res.json({
    items: items.map((r) => ({
      _id: String(r._id),
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      trigger: r.trigger,
      fetched: r.fetched,
      created: r.created,
      duplicates: r.duplicates,
      filtered: r.filtered,
      error: r.error,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  })
})

/* ---------------------------------------------------------------- worker */

adminNewsRouter.get('/worker', async (_req, res) => {
  const worker = await NewsWorker.findById('worker').lean()
  const social = await NewsSource.countDocuments({ type: 'social', enabled: true })
  res.json({
    hasKey: Boolean(worker?.keyHash),
    keyHint: worker?.keyHint ?? '',
    createdAt: worker?.createdAt?.toISOString() ?? null,
    lastSeenAt: worker?.lastSeenAt?.toISOString() ?? null,
    socialSources: social,
  })
})

adminNewsRouter.post('/worker/key', async (req, res) => {
  const actor = currentUser(res)
  const key = await rotateWorkerKey(actor._id)
  await audit(req, actor, 'news.worker.key', { type: 'news_worker', label: 'Mã máy cào' })
  res.status(201).json({ key })
})

adminNewsRouter.delete('/worker/key', async (req, res) => {
  await revokeWorkerKey()
  await audit(req, currentUser(res), 'news.worker.revoke', { type: 'news_worker', label: 'Mã máy cào' })
  res.json({ ok: true })
})
