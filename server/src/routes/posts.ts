/**
 * Journeys (trip posts) by real accounts.
 *
 *   GET    /api/posts?author=<id>          published journeys, newest first (+ their authors)
 *   GET    /api/posts/mine?status=…        your own journeys: draft | published | all
 *   GET    /api/posts/deleted              your journeys in "Recently Deleted"
 *   GET    /api/posts/:id                  published: anyone; draft or deleted: the author only
 *   POST   /api/posts/cover-signature      one signed Cloudinary upload (cover or stop photo)
 *   POST   /api/posts                      create (draft or published)
 *   PATCH  /api/posts/:id                  edit your journey
 *   POST   /api/posts/:id/publish          draft → published
 *   POST   /api/posts/:id/duplicate        copy of your journey, as a new draft
 *   DELETE /api/posts/:id                  move to "Recently Deleted"
 *   POST   /api/posts/:id/restore          back out of "Recently Deleted"
 *   DELETE /api/posts/:id/permanent        delete for good (only from "Recently Deleted")
 *
 * A journey that is not yours, or not visible to you, is always a 404: whether
 * someone else's draft exists is not something to reveal.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { destroyImages, ownPostCoverId, signPostCoverUpload } from '../lib/cloudinary.js'
import { HttpError } from '../lib/errors.js'
import { purgeAt, restoreCutoff } from '../lib/retention.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { TripPost } from '../models/TripPost.js'
import type { TripPostDocument } from '../models/TripPost.js'
import { User } from '../models/User.js'

export const postsRouter = Router()

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút.' },
})

/* ----------------------------------------------------------------- shapes */

const REGIONS = ['north', 'central', 'south', 'islands', 'overseas'] as const
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
const BUDGETS = ['low', 'medium', 'high'] as const

/** Photos an author can attach to a journey's header; the first is the cover. */
const MAX_COVER_IMAGES = 10

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
/** An https image address, or empty for "use the automatic cover". No data: URLs. */
const imageUrl = z
  .string()
  .trim()
  .max(2048, 'Địa chỉ ảnh quá dài')
  .refine((v) => v === '' || v.startsWith('https://'), 'Ảnh phải là địa chỉ https')

const locationSchema = z.object({
  _id: z.string().max(80),
  name: z.string().max(200),
  /** The stop's address as the author entered or picked it. */
  address: z.string().trim().max(300).default(''),
  note: z.string().max(2000),
  estCost: z.number().min(0).max(1e12),
  photoUrl: imageUrl.nullable(),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
})

const daySchema = z.object({
  _id: z.string().max(80),
  dayNumber: z.number().int().min(1).max(60),
  date: dateOnly,
  title: z.string().max(200),
  locations: z.array(locationSchema).max(30),
  photos: z.array(imageUrl).max(20),
})

const routeSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z
    .array(
      z.object({
        type: z.literal('Feature'),
        geometry: z.object({
          type: z.literal('LineString'),
          coordinates: z.array(z.tuple([z.number(), z.number()])).max(2000),
        }),
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .max(60),
})

/** The editor's payload (`TripPostPayload` in the web app). `authorId` is ignored: it is always you. */
const payloadSchema = z
  .object({
    title: z.string().trim().max(150, 'Tiêu đề tối đa 150 ký tự'),
    summary: z.string().trim().max(1000, 'Tóm tắt tối đa 1000 ký tự'),
    coverUrl: imageUrl,
    coverImages: z
      .array(imageUrl.refine((v) => v !== '', 'Ảnh không hợp lệ'))
      .max(MAX_COVER_IMAGES, `Tối đa ${MAX_COVER_IMAGES} ảnh`)
      .default([]),
    region: z.enum(REGIONS, 'Khu vực không hợp lệ'),
    season: z.enum(SEASONS, 'Mùa không hợp lệ'),
    startDate: dateOnly,
    endDate: dateOnly,
    days: z.array(daySchema).max(60, 'Tối đa 60 ngày'),
    tags: z.array(z.string().trim().min(1).max(40)).max(20, 'Tối đa 20 thẻ'),
    budgetLevel: z.enum(BUDGETS, 'Mức chi tiêu không hợp lệ'),
    totalEstCost: z.number().min(0).max(1e13),
    routeGeoJson: routeSchema,
    status: z.enum(['draft', 'published'], 'Trạng thái không hợp lệ'),
  })
  // A draft may be half-finished; a published journey needs a title and summary.
  .refine((p) => p.status === 'draft' || (p.title.length > 0 && p.summary.length > 0), {
    message: 'Hãy nhập tiêu đề và tóm tắt trước khi đăng.',
  })

/** What the web app's `TripPost` type expects. */
function toView(post: TripPostDocument) {
  return {
    _id: String(post._id),
    authorId: post.authorId,
    title: post.title,
    summary: post.summary,
    coverUrl: post.coverUrl,
    coverImages: post.coverImages,
    region: post.region,
    season: post.season,
    startDate: post.startDate,
    endDate: post.endDate,
    days: post.days,
    tags: post.tags,
    budgetLevel: post.budgetLevel,
    totalEstCost: post.totalEstCost,
    routeGeoJson: post.routeGeoJson,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    bookmarkCount: post.bookmarkCount,
    cloneCount: post.cloneCount,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
    purgeAt: post.deletedAt ? purgeAt(post.deletedAt).toISOString() : null,
  }
}

/** Public profile fields of each author, so the web app can show who wrote what. */
async function authorsOf(posts: TripPostDocument[]) {
  const ids = [...new Set(posts.map((p) => p.authorId))]
  const users = await User.find({ _id: { $in: ids } })
    .select('username displayName avatarUrl coverUrl bio location followerCount followingCount postCount createdAt')
    .lean()
  return users.map((u) => ({
    _id: u._id,
    username: u.username,
    displayName: u.displayName,
    email: '',
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    location: u.location,
    followerCount: u.followerCount,
    followingCount: u.followingCount,
    postCount: u.postCount,
    role: 'user' as const,
    createdAt: (u as unknown as { createdAt: Date }).createdAt.toISOString(),
  }))
}

async function adjustPostCount(userId: string, delta: number) {
  await User.updateOne({ _id: userId }, { $inc: { postCount: delta } })
  // Never below zero, whatever happened before this counter existed.
  await User.updateOne({ _id: userId, postCount: { $lt: 0 } }, { $set: { postCount: 0 } })
}

/** Your journey by id, or 404. `deleted`: whether it must be in "Recently Deleted". */
async function loadOwn(userId: string, id: string, deleted: boolean): Promise<TripPostDocument> {
  const post = isValidObjectId(id) ? await TripPost.findById(id) : null
  if (!post || post.authorId !== userId || Boolean(post.deletedAt) !== deleted) {
    throw new HttpError(404, 'Không tìm thấy hành trình.', 'NOT_FOUND')
  }
  return post
}

type DayShape = { locations?: { photoUrl?: string | null }[]; photos?: string[] }

/** Every image a journey shows: its cover photos, each stop's photo and each day's photos. */
function imagesOf(post: { coverUrl: string; coverImages?: string[]; days: unknown[] }): string[] {
  const days = post.days as DayShape[]
  const urls = [
    post.coverUrl,
    ...(post.coverImages ?? []),
    ...days.flatMap((d) => (d.locations ?? []).map((l) => l.photoUrl ?? '')),
    ...days.flatMap((d) => d.photos ?? []),
  ]
  return [...new Set(urls.filter(Boolean))]
}

/**
 * Deletes images this user uploaded, except those another of their journeys
 * still shows (a duplicate shares its source's images). Images from anywhere
 * else (default travel photos) are never touched.
 */
async function releaseImages(userId: string, urls: string[]) {
  const doomed: string[] = []
  for (const url of urls) {
    const id = ownPostCoverId(userId, url)
    if (!id) continue
    const stillUsed = await TripPost.exists({
      authorId: userId,
      $or: [{ coverUrl: url }, { coverImages: url }, { 'days.locations.photoUrl': url }, { 'days.photos': url }],
    })
    if (!stillUsed) doomed.push(id)
  }
  if (doomed.length) await destroyImages(doomed)
}

/** Removes a journey, and the uploaded images nothing else uses, for good. */
async function destroyPost(post: TripPostDocument) {
  await post.deleteOne()
  await releaseImages(post.authorId, imagesOf(post))
}

/** Deletes this user's journeys whose restore window has passed. */
async function purgeExpired(userId: string) {
  const expired = await TripPost.find({ authorId: userId, deletedAt: { $ne: null, $lt: restoreCutoff() } })
  for (const post of expired) await destroyPost(post)
}

/* ------------------------------------------------------------------ reads */

const listSchema = z.object({ author: z.string().max(40).optional().catch(undefined) })

postsRouter.get('/', async (req, res) => {
  const { author } = listSchema.parse(req.query)
  const filter: Record<string, unknown> = { status: 'published', deletedAt: null }
  if (author) filter.authorId = author
  const posts = await TripPost.find(filter).sort({ createdAt: -1 }).limit(200)
  res.json({ items: posts.map(toView), authors: await authorsOf(posts) })
})

const mineSchema = z.object({ status: z.enum(['draft', 'published', 'all']).catch('all') })

postsRouter.get('/mine', requireAuth, loadCurrentUser, async (req, res) => {
  const { status } = mineSchema.parse(req.query)
  const filter: Record<string, unknown> = { authorId: currentUser(res)._id, deletedAt: null }
  if (status !== 'all') filter.status = status
  const posts = await TripPost.find(filter).sort({ updatedAt: -1 }).limit(200)
  res.json({ items: posts.map(toView) })
})

postsRouter.get('/deleted', requireAuth, loadCurrentUser, async (_req, res) => {
  const userId = currentUser(res)._id
  await purgeExpired(userId)
  const posts = await TripPost.find({ authorId: userId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 })
  res.json({ items: posts.map(toView) })
})

postsRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = String(req.params.id)
  const post = isValidObjectId(id) ? await TripPost.findById(id) : null
  const viewerId = res.locals.userId as string | undefined
  const visible = post && ((post.status === 'published' && !post.deletedAt) || post.authorId === viewerId)
  if (!post || !visible) throw new HttpError(404, 'Không tìm thấy hành trình.', 'NOT_FOUND')
  res.json({ post: toView(post), authors: await authorsOf([post]) })
})

/* ----------------------------------------------------------------- writes */

postsRouter.post('/cover-signature', requireAuth, loadCurrentUser, writeLimiter, (_req, res) => {
  res.json(signPostCoverUpload(currentUser(res)._id))
})

postsRouter.post('/', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = payloadSchema.parse(req.body)
  const user = currentUser(res)
  const post = await TripPost.create({
    ...input,
    authorId: user._id,
    publishedAt: input.status === 'published' ? new Date() : null,
  })
  if (post.status === 'published') await adjustPostCount(user._id, 1)
  res.status(201).json({ post: toView(post) })
})

postsRouter.patch('/:id', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = payloadSchema.parse(req.body)
  const user = currentUser(res)
  const post = await loadOwn(user._id, String(req.params.id), false)

  const wasPublished = post.status === 'published'
  const oldImages = imagesOf(post)
  post.set(input)
  if (!wasPublished && post.status === 'published') post.publishedAt = new Date()
  await post.save()

  if (wasPublished !== (post.status === 'published')) await adjustPostCount(user._id, wasPublished ? -1 : 1)
  // Replaced or removed images the user uploaded may now be unused.
  const kept = new Set(imagesOf(post))
  await releaseImages(user._id, oldImages.filter((url) => !kept.has(url)))

  res.json({ post: toView(post) })
})

postsRouter.post('/:id/publish', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadOwn(user._id, String(req.params.id), false)
  if (post.status !== 'published') {
    if (!post.title.trim() || !post.summary.trim()) {
      throw new HttpError(400, 'Hãy thêm tiêu đề và tóm tắt trước khi đăng.', 'INCOMPLETE')
    }
    post.status = 'published'
    post.publishedAt = new Date()
    await post.save()
    await adjustPostCount(user._id, 1)
  }
  res.json({ post: toView(post) })
})

postsRouter.post('/:id/duplicate', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const source = await loadOwn(user._id, String(req.params.id), false)
  const copy = await TripPost.create({
    authorId: user._id,
    title: source.title ? `${source.title} (copy)`.slice(0, 150) : '',
    summary: source.summary,
    // Shared with the source; releaseImages() keeps it while either journey uses it.
    coverUrl: source.coverUrl,
    coverImages: source.coverImages,
    region: source.region,
    season: source.season,
    startDate: source.startDate,
    endDate: source.endDate,
    days: source.days,
    tags: source.tags,
    budgetLevel: source.budgetLevel,
    totalEstCost: source.totalEstCost,
    routeGeoJson: source.routeGeoJson,
    status: 'draft',
  })
  res.status(201).json({ post: toView(copy) })
})

postsRouter.delete('/:id', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadOwn(user._id, String(req.params.id), false)
  post.deletedAt = new Date()
  await post.save()
  if (post.status === 'published') await adjustPostCount(user._id, -1)
  res.json({ post: toView(post) })
})

postsRouter.post('/:id/restore', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadOwn(user._id, String(req.params.id), true)
  post.deletedAt = null
  await post.save()
  if (post.status === 'published') await adjustPostCount(user._id, 1)
  res.json({ post: toView(post) })
})

postsRouter.delete('/:id/permanent', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadOwn(user._id, String(req.params.id), true)
  await destroyPost(post)
  res.json({ ok: true })
})
