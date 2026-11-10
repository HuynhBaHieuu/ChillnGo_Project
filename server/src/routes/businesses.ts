/**
 * /api/businesses — business pages (homestays, hotels, restaurants, cafés,
 * tours) and the ads they post.
 *
 *   GET    /api/businesses/sponsored            "Gợi ý nổi bật" on Discover: paid-up businesses and their latest ads
 *   GET    /api/businesses/me                   your business (any status) and all its ads, or { business: null }
 *   POST   /api/businesses                      register one (one per account) → 201, waits for an admin
 *   PATCH  /api/businesses/me                   edit it; a rejected one goes back to review
 *   POST   /api/businesses/me/posts             write an ad → 201
 *   PATCH  /api/businesses/me/posts/:postId     edit an ad
 *   DELETE /api/businesses/me/posts/:postId     delete an ad
 *   GET    /api/businesses/:slug                a business page and its ads (public once approved)
 *
 * Photos are uploaded first with POST /api/posts/cover-signature, then their
 * Cloudinary URLs are sent here. Paying for the "Đề xuất" package goes
 * through /api/billing (routes/billing.ts).
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'

import {
  businessInputSchema,
  businessPostInputSchema,
  businessPostView,
  businessView,
  isPublic,
  shuffled,
  slugify,
} from '../lib/businesses.js'
import { HttpError, rateLimitBody } from '../lib/errors.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Business, BusinessPost } from '../models/Business.js'
import type { BusinessDocument } from '../models/Business.js'
import { NOT_MODERATED } from '../models/moderation.js'

export const businessesRouter = Router()

/** Businesses and ads shown in "Gợi ý nổi bật" at a time. */
const SPONSORED_BUSINESSES = 8
const SPONSORED_POSTS = 8

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitBody('Bạn thao tác quá nhanh. Vui lòng đợi một chút.'),
})

const NOT_FOUND = () => new HttpError(404, 'Không tìm thấy cơ sở kinh doanh.', 'NOT_FOUND')

/** A slug no other business has: the name's, or with -2, -3… after it. */
async function freeSlug(name: string, ownId?: string): Promise<string> {
  const base = slugify(name)
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const taken = await Business.exists({ slug, ...(ownId && { _id: { $ne: ownId } }) })
    if (!taken) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

async function loadOwn(userId: string): Promise<BusinessDocument> {
  const business = await Business.findOne({ ownerId: userId })
  if (!business) throw new HttpError(404, 'Bạn chưa đăng ký cơ sở kinh doanh.', 'NOT_FOUND')
  return business
}

/* ----------------------------------------------------------------- public */

businessesRouter.get('/sponsored', async (_req, res) => {
  const now = new Date()
  const businesses = await Business.find({ status: 'approved', promotedUntil: { $gt: now }, ...NOT_MODERATED })
    .limit(200)
  const picked = shuffled(businesses).slice(0, SPONSORED_BUSINESSES)

  const ids = businesses.map((b) => String(b._id))
  const posts = await BusinessPost.find({ businessId: { $in: ids }, deletedAt: null, ...NOT_MODERATED })
    .sort({ createdAt: -1 })
    .limit(SPONSORED_POSTS * 3)
  // The newest ad of as many businesses as possible before a second one of any.
  const seen = new Map<string, number>()
  const ranked = posts
    .map((post) => {
      const rank = seen.get(post.businessId) ?? 0
      seen.set(post.businessId, rank + 1)
      return { post, rank }
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, SPONSORED_POSTS)
    .map((r) => r.post)

  const byId = new Map(businesses.map((b) => [String(b._id), b]))
  res.json({
    businesses: picked.map((b) => businessView(b, { owner: false })),
    posts: ranked.map((post) => {
      const business = byId.get(post.businessId)!
      return { ...businessPostView(post, { owner: false }), business: businessView(business, { owner: false }) }
    }),
  })
})

/* ------------------------------------------------------------------ owner */

businessesRouter.get('/me', requireAuth, loadCurrentUser, async (_req, res) => {
  const business = await Business.findOne({ ownerId: currentUser(res)._id })
  if (!business) {
    res.json({ business: null, posts: [] })
    return
  }
  const posts = await BusinessPost.find({ businessId: String(business._id), deletedAt: null }).sort({ createdAt: -1 })
  res.json({
    business: businessView(business, { owner: true }),
    posts: posts.map((p) => businessPostView(p, { owner: true })),
  })
})

businessesRouter.post('/', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = businessInputSchema.parse(req.body)
  const user = currentUser(res)
  if (await Business.exists({ ownerId: user._id })) {
    throw new HttpError(409, 'Mỗi tài khoản chỉ đăng ký được một cơ sở kinh doanh.', 'ALREADY_EXISTS')
  }
  const business = await Business.create({ ...input, ownerId: user._id, slug: await freeSlug(input.name) })
  res.status(201).json({ business: businessView(business, { owner: true }) })
})

businessesRouter.patch('/me', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = businessInputSchema.parse(req.body)
  const business = await loadOwn(currentUser(res)._id)
  if (business.status === 'hidden') {
    throw new HttpError(403, 'Cơ sở đang bị ẩn bởi quản trị viên nên chưa sửa được. Hãy liên hệ hỗ trợ.', 'BUSINESS_HIDDEN')
  }
  const slug = input.name === business.name ? business.slug : await freeSlug(input.name, String(business._id))
  business.set({ ...input, slug })
  // Fixed after a rejection: back in the queue.
  if (business.status === 'rejected') business.set({ status: 'pending', statusReason: '' })
  await business.save()
  res.json({ business: businessView(business, { owner: true }) })
})

businessesRouter.post('/me/posts', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = businessPostInputSchema.parse(req.body)
  const user = currentUser(res)
  const business = await loadOwn(user._id)
  if (business.status === 'hidden') {
    throw new HttpError(403, 'Cơ sở đang bị ẩn bởi quản trị viên nên chưa đăng bài được.', 'BUSINESS_HIDDEN')
  }
  const post = await BusinessPost.create({ ...input, businessId: String(business._id), authorId: user._id })
  res.status(201).json({ post: businessPostView(post, { owner: true }) })
})

async function loadOwnPost(userId: string, postId: string) {
  const post = isValidObjectId(postId) ? await BusinessPost.findOne({ _id: postId, authorId: userId, deletedAt: null }) : null
  if (!post) throw new HttpError(404, 'Không tìm thấy bài quảng cáo.', 'NOT_FOUND')
  return post
}

businessesRouter.patch('/me/posts/:postId', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = businessPostInputSchema.parse(req.body)
  const post = await loadOwnPost(currentUser(res)._id, String(req.params.postId))
  post.set(input)
  await post.save()
  res.json({ post: businessPostView(post, { owner: true }) })
})

businessesRouter.delete('/me/posts/:postId', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const post = await loadOwnPost(currentUser(res)._id, String(req.params.postId))
  post.deletedAt = new Date()
  await post.save()
  res.json({ ok: true })
})

/* --------------------------------------------------------------- one page */

businessesRouter.get('/:slug', optionalAuth, async (req, res) => {
  const slug = String(req.params.slug).toLowerCase()
  const business = /^[a-z0-9-]{1,80}$/.test(slug) ? await Business.findOne({ slug }) : null
  if (!business) throw NOT_FOUND()
  const owner = business.ownerId === (res.locals.userId as string | undefined)
  if (!owner && !isPublic(business)) throw NOT_FOUND()

  const posts = await BusinessPost.find({
    businessId: String(business._id),
    deletedAt: null,
    ...(owner ? {} : NOT_MODERATED),
  })
    .sort({ createdAt: -1 })
    .limit(50)
  res.json({
    business: businessView(business, { owner }),
    posts: posts.map((p) => businessPostView(p, { owner })),
  })
})
