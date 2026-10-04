/**
 * /api/checkins — photo check-ins.
 *
 *   GET    /api/checkins?authors=a,b&before=ISO   newest first, 20 at a time (public)
 *   POST   /api/checkins/upload-signature          one signed Cloudinary upload per photo
 *   POST   /api/checkins                           { caption, photos: publicId[], feeling?, location? }
 *   DELETE /api/checkins/:id                       author only; moves it to "Recently Deleted"
 *   GET    /api/checkins/deleted                   your check-ins in "Recently Deleted"
 *   POST   /api/checkins/:id/restore               back out of "Recently Deleted"
 *   DELETE /api/checkins/:id/permanent             delete for good, photos included
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { confirmCheckinPhoto, destroyImages, signCheckinUpload } from '../lib/cloudinary.js'
import { HttpError } from '../lib/errors.js'
import { FEELINGS } from '../lib/feelings.js'
import { purgeAt, restoreCutoff } from '../lib/retention.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { CheckIn } from '../models/CheckIn.js'
import { User } from '../models/User.js'

export const checkinsRouter = Router()

const PAGE_SIZE = 20
export const MAX_PHOTOS = 4

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút.' },
})

type CheckInDoc = InstanceType<typeof CheckIn>

/** Check-ins with their authors' public profile fields. */
async function withAuthors(items: CheckInDoc[]) {
  const ids = [...new Set(items.map((c) => c.authorId))]
  const authors = await User.find({ _id: { $in: ids } }).select('username displayName avatarUrl').lean()
  const byId = new Map(authors.map((a) => [a._id, a]))

  return items.map((c) => {
    const author = byId.get(c.authorId)
    return {
      _id: String(c._id),
      caption: c.caption,
      feeling: c.feeling ?? null,
      photos: c.photos.map((p) => ({ url: p.url, width: p.width, height: p.height })),
      location: c.location
        ? { name: c.location.name, address: c.location.address, lat: c.location.lat, lng: c.location.lng }
        : null,
      createdAt: c.createdAt.toISOString(),
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
      purgeAt: c.deletedAt ? purgeAt(c.deletedAt).toISOString() : null,
      author: author
        ? { _id: author._id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
        : { _id: c.authorId, username: 'deleted', displayName: 'Tài khoản đã xoá', avatarUrl: '' },
    }
  })
}

const listSchema = z.object({
  authors: z
    .string()
    .max(4000)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200) : undefined)),
  before: z.iso.datetime().optional().catch(undefined),
})

/** GET /api/checkins — anyone may read. `authors` narrows to those accounts (the Newsfeed). */
checkinsRouter.get('/', async (req, res) => {
  const { authors, before } = listSchema.parse(req.query)
  const filter: Record<string, unknown> = { deletedAt: null }
  if (authors) filter.authorId = { $in: authors }
  if (before) filter.createdAt = { $lt: new Date(before) }

  const items = await CheckIn.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE)
  res.json({ items: await withAuthors(items) })
})

/** POST /api/checkins/upload-signature → { publicId, uploadUrl, fields } */
checkinsRouter.post('/upload-signature', requireAuth, loadCurrentUser, writeLimiter, (_req, res) => {
  res.json(signCheckinUpload(currentUser(res)._id))
})

const createSchema = z.object({
  caption: z.string('Nội dung không hợp lệ').trim().max(500, 'Nội dung tối đa 500 ký tự').default(''),
  photos: z
    .array(z.string().max(200), 'Ảnh không hợp lệ')
    .max(MAX_PHOTOS, `Tối đa ${MAX_PHOTOS} ảnh`)
    .refine((ids) => new Set(ids).size === ids.length, 'Ảnh bị trùng')
    .default([]),
  feeling: z.enum(FEELINGS, 'Cảm xúc không hợp lệ').nullable().default(null),
  location: z
    .object({
      name: z.string().trim().min(1, 'Thiếu tên địa điểm').max(120, 'Tên địa điểm quá dài'),
      address: z.string().trim().max(200).default(''),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .default(null),
})
  .refine((c) => c.photos.length > 0 || c.feeling !== null || c.caption.length > 0, {
    message: 'Hãy thêm ảnh, cảm xúc hoặc vài dòng chia sẻ.',
  })

/** POST /api/checkins → 201 { checkin } */
checkinsRouter.post('/', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const input = createSchema.parse(req.body)
  const user = currentUser(res)

  const photos = await Promise.all(input.photos.map((id) => confirmCheckinPhoto(user._id, id)))
  const checkin = await CheckIn.create({
    authorId: user._id,
    caption: input.caption,
    feeling: input.feeling,
    photos,
    location: input.location,
  })

  const [shown] = await withAuthors([checkin])
  res.status(201).json({ checkin: shown })
})

/** A check-in of yours, or 404. `deleted`: whether it must be in "Recently Deleted". */
async function loadOwn(userId: string, id: string, deleted: boolean) {
  const checkin = await CheckIn.findById(id).catch(() => null)
  if (!checkin || checkin.authorId !== userId || Boolean(checkin.deletedAt) !== deleted) {
    throw new HttpError(404, 'Không tìm thấy check-in.', 'NOT_FOUND')
  }
  return checkin
}

async function destroyCheckIn(checkin: CheckInDoc) {
  await checkin.deleteOne()
  await destroyImages(checkin.photos.map((p) => p.publicId))
}

/** GET /api/checkins/deleted — yours, newest deletion first. Expired ones are removed first. */
checkinsRouter.get('/deleted', requireAuth, loadCurrentUser, async (_req, res) => {
  const user = currentUser(res)
  const expired = await CheckIn.find({ authorId: user._id, deletedAt: { $ne: null, $lt: restoreCutoff() } })
  for (const checkin of expired) await destroyCheckIn(checkin)

  const items = await CheckIn.find({ authorId: user._id, deletedAt: { $ne: null } }).sort({ deletedAt: -1 })
  res.json({ items: await withAuthors(items) })
})

/** DELETE /api/checkins/:id — only the author. Restorable for lib/retention.ts's window. */
checkinsRouter.delete('/:id', requireAuth, loadCurrentUser, async (req, res) => {
  const checkin = await loadOwn(currentUser(res)._id, String(req.params.id), false)
  checkin.deletedAt = new Date()
  await checkin.save()
  res.json({ ok: true })
})

checkinsRouter.post('/:id/restore', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const checkin = await loadOwn(currentUser(res)._id, String(req.params.id), true)
  // Past the window it is gone, even when the clean-up has not run yet.
  if (checkin.deletedAt && checkin.deletedAt < restoreCutoff()) {
    await destroyCheckIn(checkin)
    throw new HttpError(410, 'Check-in này đã quá hạn khôi phục và đã bị xoá vĩnh viễn.', 'RESTORE_EXPIRED')
  }
  checkin.deletedAt = null
  await checkin.save()
  res.json({ ok: true })
})

checkinsRouter.delete('/:id/permanent', requireAuth, loadCurrentUser, async (req, res) => {
  const checkin = await loadOwn(currentUser(res)._id, String(req.params.id), true)
  await destroyCheckIn(checkin)
  res.json({ ok: true })
})
