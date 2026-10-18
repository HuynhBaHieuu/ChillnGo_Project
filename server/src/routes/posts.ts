/**
 * Journeys (trip posts) by real accounts.
 *
 *   GET    /api/posts?author=<id>          published journeys, newest first (+ their authors)
 *   GET    /api/posts/mine?status=…        your own journeys: draft | published | all
 *   GET    /api/posts/deleted              your journeys in "Recently Deleted"
 *   GET    /api/posts/:id                  published: anyone; draft or deleted: the author only
 *   GET    /api/posts/liked-ids            ids of the journeys you have liked
 *   POST   /api/posts/:id/like             like / unlike (toggle); tells the author
 *   GET    /api/posts/:id/comments         comments on a published journey (+ their authors)
 *   POST   /api/posts/:id/comments         comment or reply; tells the author / the person replied to
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
import { Notification, notify } from '../models/Notification.js'
import { PostComment, PostLike } from '../models/PostInteraction.js'
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
/** How a leg was travelled (TravelMode in the web app). The first three follow roads. */
const TRAVEL_MODES = ['driving', 'walking', 'transit', 'flight', 'ferry'] as const
const ROAD_MODES = new Set<string>(['driving', 'walking', 'transit'])

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
  /** How the stop was reached from the day's previous stop. Absent on older stops, read as driving. */
  travelMode: z.enum(TRAVEL_MODES).optional(),
  /** Place categories from search (e.g. "airport"); the editor suggests a travel mode from them. */
  placeTypes: z.array(z.string().trim().max(60)).max(12).optional(),
  /** The road route into this stop, cached so viewers need no Directions call. */
  legRoute: z
    .object({
      key: z.string().max(200),
      /** Mapbox polyline6. */
      polyline: z.string().max(200_000),
      duration: z.number().min(0).max(1e7),
      distance: z.number().min(0).max(1e8),
    })
    .optional(),
  /** The Place this stop is (models/Place.ts), which AI clone reads its facts from. */
  placeId: z.string().max(40).optional(),
  /** Arrival and stay planned by AI clone. */
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  durationMin: z.number().int().min(0).max(1440).optional(),
  /** No cost data: `estCost` is 0 for want of one, not because it is free. */
  costUnknown: z.boolean().optional(),
})

type LocationInput = z.infer<typeof locationSchema>

/** Where a new stop sits until the author places it (UNPINNED in web/src/lib/itinerary.ts): not on the map. */
const isPinned = (loc: LocationInput) => !(loc.lng === 106 && loc.lat === 16)

/** The road leg from a to b, as `legKey` in web/src/lib/travel.ts names it. */
function legKey(a: LocationInput, b: LocationInput, mode: (typeof TRAVEL_MODES)[number]): string {
  const at = (l: LocationInput) => `${l.lng.toFixed(5)},${l.lat.toFixed(5)}`
  return `${mode === 'walking' ? 'walking' : 'driving'}:${at(a)};${at(b)}`
}

function withoutLegRoute({ legRoute: _dropped, ...loc }: LocationInput): LocationInput {
  return loc
}

/**
 * Keeps a stop's cached road route only while it still describes the leg into
 * it: a road mode, from the same previous stop, to the same place. A moved
 * stop or a changed mode leaves that leg without one, and the web app draws
 * and caches it afresh; every other leg keeps its route.
 */
function keepCurrentLegRoutes(locations: LocationInput[]): LocationInput[] {
  let previous: LocationInput | null = null
  return locations.map((loc) => {
    if (!isPinned(loc)) return withoutLegRoute(loc)
    const from = previous
    previous = loc
    const mode = loc.travelMode ?? 'driving'
    const current = from && ROAD_MODES.has(mode) && loc.legRoute?.key === legKey(from, loc, mode)
    return current ? loc : withoutLegRoute(loc)
  })
}

export const daySchema = z.object({
  _id: z.string().max(80),
  dayNumber: z.number().int().min(1).max(60),
  date: dateOnly,
  title: z.string().max(200),
  locations: z.array(locationSchema).max(30).transform(keepCurrentLegRoutes),
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

type DayShape = { locations?: { photoUrl?: string | null; legRoute?: unknown }[]; photos?: string[] }

/** For lists: without the cached road routes, which only the journey's own map needs. */
function toListView(post: TripPostDocument) {
  const view = toView(post)
  return {
    ...view,
    days: (view.days as DayShape[]).map((day) => ({
      ...day,
      locations: (day.locations ?? []).map(({ legRoute: _dropped, ...loc }) => loc),
    })),
  }
}

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
  const postId = String(post._id)
  await Promise.all([
    PostLike.deleteMany({ postId }),
    PostComment.deleteMany({ postId }),
    Notification.deleteMany({ postId }),
  ])
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
  res.json({ items: posts.map(toListView), authors: await authorsOf(posts) })
})

const mineSchema = z.object({ status: z.enum(['draft', 'published', 'all']).catch('all') })

postsRouter.get('/mine', requireAuth, loadCurrentUser, async (req, res) => {
  const { status } = mineSchema.parse(req.query)
  const filter: Record<string, unknown> = { authorId: currentUser(res)._id, deletedAt: null }
  if (status !== 'all') filter.status = status
  const posts = await TripPost.find(filter).sort({ updatedAt: -1 }).limit(200)
  res.json({ items: posts.map(toListView) })
})

postsRouter.get('/deleted', requireAuth, loadCurrentUser, async (_req, res) => {
  const userId = currentUser(res)._id
  await purgeExpired(userId)
  const posts = await TripPost.find({ authorId: userId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 })
  res.json({ items: posts.map(toListView) })
})

postsRouter.get('/liked-ids', requireAuth, async (_req, res) => {
  const likes = await PostLike.find({ userId: res.locals.userId as string }).sort({ createdAt: -1 }).select('postId').lean()
  res.json({ ids: likes.map((l) => l.postId) })
})

postsRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = String(req.params.id)
  const post = isValidObjectId(id) ? await TripPost.findById(id) : null
  const viewerId = res.locals.userId as string | undefined
  const visible = post && ((post.status === 'published' && !post.deletedAt) || post.authorId === viewerId)
  if (!post || !visible) throw new HttpError(404, 'Không tìm thấy hành trình.', 'NOT_FOUND')
  const likedByMe = viewerId ? Boolean(await PostLike.exists({ postId: String(post._id), userId: viewerId })) : false
  res.json({ post: toView(post), authors: await authorsOf([post]), likedByMe })
})

/* ------------------------------------------------------ likes & comments */

/** A published, not-deleted journey that anyone may like or comment on, or 404. */
async function loadPublished(id: string): Promise<TripPostDocument> {
  const post = isValidObjectId(id) ? await TripPost.findById(id) : null
  if (!post || post.status !== 'published' || post.deletedAt) {
    throw new HttpError(404, 'Không tìm thấy hành trình.', 'NOT_FOUND')
  }
  return post
}

/** The counters are recounted rather than stepped, so they cannot drift from the rows. */
async function recountLikes(postId: string): Promise<number> {
  const likeCount = await PostLike.countDocuments({ postId })
  await TripPost.updateOne({ _id: postId }, { $set: { likeCount } })
  return likeCount
}

async function recountComments(postId: string): Promise<number> {
  const commentCount = await PostComment.countDocuments({ postId, hidden: { $ne: true } })
  await TripPost.updateOne({ _id: postId }, { $set: { commentCount } })
  return commentCount
}

/** A comment cut down for a notification line. */
function snippet(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

postsRouter.post('/:id/like', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadPublished(String(req.params.id))
  const postId = String(post._id)

  const removed = await PostLike.findOneAndDelete({ postId, userId: user._id })
  let likedByMe = false
  if (removed) {
    // Unliking takes the notification back, so liking again does not stack up copies.
    await Notification.deleteMany({ type: 'like', postId, actorId: user._id })
  } else {
    try {
      await PostLike.create({ postId, userId: user._id })
      likedByMe = true
      if (post.authorId !== user._id) {
        await notify([post.authorId], {
          type: 'like',
          actorId: user._id,
          postId,
          message: `đã thích hành trình “${snippet(post.title, 50) || 'của bạn'}”`,
        })
      }
    } catch (error) {
      // A double tap raced us: the like already exists.
      if ((error as { code?: number }).code !== 11000) throw error
      likedByMe = true
    }
  }

  res.json({ likeCount: await recountLikes(postId), likedByMe })
})

postsRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  const post = await loadPublished(String(req.params.id))
  const postId = String(post._id)
  const viewerId = res.locals.userId as string | undefined
  const all = await PostComment.find({ postId }).sort({ createdAt: 1 }).limit(500).lean()

  // A hidden comment (and the replies under it) is seen only by its writer and the journey's author.
  const canSee = (c: { authorId: string; hidden?: boolean | null }) =>
    !c.hidden || (viewerId !== undefined && (c.authorId === viewerId || post.authorId === viewerId))
  const rootVisible = new Map(all.filter((c) => !c.parentId).map((c) => [String(c._id), canSee(c)]))
  const comments = all.filter((c) => canSee(c) && (!c.parentId || rootVisible.get(c.parentId) === true))

  const authors = await User.find({ _id: { $in: [...new Set(comments.map((c) => c.authorId))] } })
    .select('username displayName avatarUrl coverUrl bio location followerCount followingCount postCount createdAt')
    .lean()
  res.json({
    items: comments.map((c) => ({
      _id: String(c._id),
      postId: c.postId,
      authorId: c.authorId,
      parentId: c.parentId,
      content: c.content,
      likeCount: 0,
      hidden: Boolean(c.hidden),
      createdAt: c.createdAt.toISOString(),
    })),
    authors: authors.map((u) => ({
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
    })),
  })
})

const commentSchema = z.object({
  content: z.string().trim().min(1, 'Hãy nhập nội dung bình luận.').max(1000, 'Bình luận tối đa 1000 ký tự'),
  parentId: z.string().max(40).nullable().default(null),
})

postsRouter.post('/:id/comments', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const { content, parentId } = commentSchema.parse(req.body)
  const user = currentUser(res)
  const post = await loadPublished(String(req.params.id))
  const postId = String(post._id)

  // A reply to a reply goes under the same root.
  let root: { _id: unknown; authorId: string } | null = null
  if (parentId) {
    const parent = isValidObjectId(parentId) ? await PostComment.findById(parentId).lean() : null
    if (!parent || parent.postId !== postId) throw new HttpError(404, 'Không tìm thấy bình luận để trả lời.', 'NOT_FOUND')
    root = parent.parentId ? await PostComment.findById(parent.parentId).lean() : parent
    if (!root) throw new HttpError(404, 'Không tìm thấy bình luận để trả lời.', 'NOT_FOUND')
  }

  const comment = await PostComment.create({ postId, authorId: user._id, parentId: root ? String(root._id) : null, content })
  const commentCount = await recountComments(postId)

  // Whoever is addressed hears about it once: the person replied to, then the author.
  const told = new Set<string>([user._id])
  const title = snippet(post.title, 40) || 'của bạn'
  if (root && !told.has(root.authorId)) {
    told.add(root.authorId)
    await notify([root.authorId], {
      type: 'comment',
      actorId: user._id,
      postId,
      commentId: String(comment._id),
      message: `đã trả lời bình luận của bạn: “${snippet(content)}”`,
    })
  }
  if (!told.has(post.authorId)) {
    await notify([post.authorId], {
      type: 'comment',
      actorId: user._id,
      postId,
      commentId: String(comment._id),
      message: `đã bình luận hành trình “${title}”: “${snippet(content)}”`,
    })
  }

  res.status(201).json({
    comment: {
      _id: String(comment._id),
      postId,
      authorId: user._id,
      parentId: comment.parentId,
      content: comment.content,
      likeCount: 0,
      createdAt: comment.createdAt.toISOString(),
    },
    commentCount,
  })
})

postsRouter.delete('/:id/comments/:commentId', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const post = await loadPublished(String(req.params.id))
  const postId = String(post._id)
  const commentId = String(req.params.commentId)

  const comment = isValidObjectId(commentId) ? await PostComment.findOne({ _id: commentId, postId }) : null
  if (!comment) throw new HttpError(404, 'Không tìm thấy bình luận.', 'NOT_FOUND')
  // You may remove your own comment, and the journey's author may remove any comment on it.
  if (comment.authorId !== user._id && post.authorId !== user._id) {
    throw new HttpError(403, 'Bạn không thể xoá bình luận này.', 'FORBIDDEN')
  }

  // A root comment takes its replies with it.
  const replies = comment.parentId ? [] : await PostComment.find({ postId, parentId: commentId }).select('_id').lean()
  const doomed = [commentId, ...replies.map((r) => String(r._id))]
  await PostComment.deleteMany({ _id: { $in: doomed } })
  await Notification.deleteMany({ type: 'comment', postId, commentId: { $in: doomed } })

  res.json({ commentCount: await recountComments(postId), deletedIds: doomed })
})

const hideSchema = z.object({ hidden: z.boolean() })

postsRouter.post('/:id/comments/:commentId/hide', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const { hidden } = hideSchema.parse(req.body)
  const user = currentUser(res)
  const post = await loadPublished(String(req.params.id))
  const postId = String(post._id)
  if (post.authorId !== user._id) throw new HttpError(403, 'Chỉ tác giả hành trình mới ẩn được bình luận.', 'FORBIDDEN')

  const commentId = String(req.params.commentId)
  const comment = isValidObjectId(commentId) ? await PostComment.findOne({ _id: commentId, postId }) : null
  if (!comment) throw new HttpError(404, 'Không tìm thấy bình luận.', 'NOT_FOUND')
  if (comment.authorId === user._id) throw new HttpError(400, 'Hãy xoá bình luận của chính bạn thay vì ẩn.', 'OWN_COMMENT')

  comment.hidden = hidden
  await comment.save()
  res.json({ hidden, commentCount: await recountComments(postId) })
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
  // Past the window it is gone, even when the clean-up has not run yet.
  if (post.deletedAt && post.deletedAt < restoreCutoff()) {
    await destroyPost(post)
    throw new HttpError(410, 'Hành trình này đã quá hạn khôi phục và đã bị xoá vĩnh viễn.', 'RESTORE_EXPIRED')
  }
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
