/**
 * /api/news — travel news gathered from outside sources (lib/news) for the
 * Newsfeed, plus the two machine entry points that feed it.
 *
 *   GET  /api/news?region&before        published news, newest first (pinned first on the first page)
 *   GET  /api/news/saved                news the signed-in user saved
 *   GET  /api/news/:id                  one published item with its post (paragraphs, pictures)
 *   POST /api/news/:id/save             save / unsave (toggle)
 *   POST /api/news/:id/click            counts a reader opening the post
 *   GET  /api/news/cron                 the scheduler (Bearer CRON_SECRET): fetch due sources, run the AI step
 *   GET  /api/news/worker/sources       the news worker (X-Worker-Key): social sources due now
 *   POST /api/news/worker/ingest        the news worker: items it fetched, or the error it met
 *
 * Each item is a post written by the AI from the original (lib/news/pipeline);
 * the original's text is not kept, its pictures are shown by link and the
 * post ends with the link back.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { env } from '../env.js'
import { HttpError, rateLimitBody } from '../lib/errors.js'
import { dueWorkerSources, ingest, runDueSources, verifyCronSecret, verifyWorkerKey, workerFailure } from '../lib/news/pipeline.js'
import { itemView, workerIngestSchema } from '../lib/news/views.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Destination } from '../models/Destination.js'
import { NOT_MODERATED } from '../models/moderation.js'
import { NEWS_REGIONS, NewsItem, NewsSave, NewsSource } from '../models/News.js'

export const newsRouter = Router()

const PAGE = 20

const listSchema = z.object({
  region: z.enum(NEWS_REGIONS).optional().catch(undefined),
  before: z.iso.datetime().optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(50).catch(PAGE).default(PAGE),
})

newsRouter.get('/', optionalAuth, async (req, res) => {
  const { region, before, limit } = listSchema.parse(req.query)
  const filter: Record<string, unknown> = { status: 'published', ...NOT_MODERATED }
  if (region) filter.regions = region

  // Pinned items lead the first page only.
  const pinned = before ? [] : await NewsItem.find({ ...filter, pinned: true }).sort({ publishedAt: -1 }).limit(5)
  const rest = await NewsItem.find({
    ...filter,
    pinned: { $ne: true },
    ...(before && { publishedAt: { $lt: new Date(before) } }),
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
  const items = [...pinned, ...rest]

  const viewerId = res.locals.userId as string | undefined
  const saved = viewerId
    ? new Set((await NewsSave.find({ userId: viewerId, itemId: { $in: items.map((i) => String(i._id)) } }).lean()).map((s) => s.itemId))
    : null
  res.json({
    items: items.map((i) => itemView(i, saved ? { saved: saved.has(String(i._id)) } : {})),
    nextBefore: rest.length === limit ? rest[rest.length - 1].publishedAt.toISOString() : null,
  })
})

newsRouter.get('/saved', requireAuth, loadCurrentUser, async (_req, res) => {
  const saves = await NewsSave.find({ userId: currentUser(res)._id }).sort({ createdAt: -1 }).limit(100).lean()
  const items = await NewsItem.find({ _id: { $in: saves.map((s) => s.itemId) }, status: 'published', ...NOT_MODERATED })
  const byId = new Map(items.map((i) => [String(i._id), i]))
  res.json({
    items: saves.flatMap((s) => {
      const item = byId.get(s.itemId)
      return item ? [{ ...itemView(item, { saved: true }), savedAt: s.createdAt.toISOString() }] : []
    }),
  })
})

/* ------------------------------------------------------------ machines */

newsRouter.get('/cron', async (req, res) => {
  verifyCronSecret(req.get('authorization'), env.cronSecret)
  res.json(await runDueSources('schedule'))
})

newsRouter.get('/worker/sources', async (req, res) => {
  await verifyWorkerKey(req.get('x-worker-key'))
  const sources = await dueWorkerSources()
  res.json({
    items: sources.map((s) => ({
      _id: String(s._id),
      name: s.name,
      platform: s.platform,
      query: s.query,
      url: s.url,
    })),
  })
})

newsRouter.post('/worker/ingest', async (req, res) => {
  await verifyWorkerKey(req.get('x-worker-key'))
  const input = workerIngestSchema.parse(req.body)
  const source = await NewsSource.findOne({ _id: input.sourceId, type: 'social' })
  if (!source) throw new HttpError(404, 'Không tìm thấy nguồn.', 'NOT_FOUND')
  if (input.error) {
    await workerFailure(source, input.error)
    res.json({ ok: true, recorded: 'error' })
    return
  }
  const result = await ingest(
    source,
    input.items.map((i) => {
      const published = i.publishedAt ? new Date(i.publishedAt) : new Date()
      return { ...i, publishedAt: Number.isNaN(published.getTime()) ? new Date() : published }
    }),
    'worker',
  )
  res.json({ ok: true, ...result })
})

/* -------------------------------------------------------------- per item */

const clickLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitBody('Bạn thao tác quá nhanh.'),
})

async function loadPublished(id: string) {
  const item = isValidObjectId(id) ? await NewsItem.findOne({ _id: id, status: 'published', ...NOT_MODERATED }) : null
  if (!item) throw new HttpError(404, 'Không tìm thấy tin.', 'NOT_FOUND')
  return item
}

newsRouter.get('/:id', optionalAuth, async (req, res) => {
  const item = await loadPublished(String(req.params.id))
  const viewerId = res.locals.userId as string | undefined
  const saved = viewerId ? Boolean(await NewsSave.exists({ userId: viewerId, itemId: String(item._id) })) : undefined
  // Where the catalog destinations it mentions are, for the page's map.
  const places = item.destinations.length
    ? (await Destination.find({ name: { $in: item.destinations } }).select('name lat lng').lean()).map((d) => ({ name: d.name, lat: d.lat, lng: d.lng }))
    : []
  res.json({ item: { ...itemView(item, { detail: true, saved }), places } })
})

newsRouter.post('/:id/click', clickLimiter, async (req, res) => {
  const item = await loadPublished(String(req.params.id))
  await NewsItem.updateOne({ _id: item._id }, { $inc: { clickCount: 1 } })
  res.json({ ok: true })
})

newsRouter.post('/:id/save', requireAuth, loadCurrentUser, clickLimiter, async (req, res) => {
  const item = await loadPublished(String(req.params.id))
  const userId = currentUser(res)._id
  const removed = await NewsSave.findOneAndDelete({ userId, itemId: String(item._id) })
  if (!removed) {
    try {
      await NewsSave.create({ userId, itemId: String(item._id) })
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  res.json({ saved: !removed })
})
