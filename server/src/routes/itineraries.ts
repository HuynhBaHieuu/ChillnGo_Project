/**
 * Itineraries cloned from journeys ("Đã sao chép"), private to their owner.
 *
 *   GET    /api/itineraries                  your itineraries, newest first
 *   GET    /api/itineraries/:id              one of yours
 *   POST   /api/itineraries                  clone a journey as it is: { postId, title?, startDate?, source? }
 *   PATCH  /api/itineraries/:id/days         new day order: { dayIds }
 *   POST   /api/itineraries/:id/merge        append days of other journeys: { selections: [{ postId, dayIds, source? }] }
 *   DELETE /api/itineraries/:id/days/:dayId  remove a day
 *
 * Journeys stored here are read here. The web app's sample journeys (ids like
 * p_001) live only in the browser, so for those it sends the days along
 * (`source`); they land in the sender's own private itinerary and nowhere else.
 * AI-adapted itineraries arrive through routes/aiClone.ts.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { Types, isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { HttpError } from '../lib/errors.js'
import { addDays, creditClone, isServerPostId, readableJourney, rekeyDays, totalCostOf } from '../lib/journeys.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Itinerary, itineraryView } from '../models/Itinerary.js'
import type { ItineraryDocument } from '../models/Itinerary.js'
import { daySchema } from './posts.js'

export const itinerariesRouter = Router()

itinerariesRouter.use(requireAuth, loadCurrentUser)

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút.' },
})

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')

/** A sample journey's days, as the browser has them. */
const sourceSchema = z.object({
  title: z.string().trim().max(200).default(''),
  coverUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === '' || v.startsWith('https://'), 'Ảnh phải là địa chỉ https')
    .default(''),
  startDate: dateOnly,
  days: z.array(daySchema).max(60, 'Tối đa 60 ngày'),
})

/** The days (and title, cover) of the journey `postId`: read here, or as sent for a sample journey. */
async function journeyFor(postId: string, userId: string, source: z.infer<typeof sourceSchema> | undefined) {
  if (isServerPostId(postId)) return readableJourney(postId, userId)
  if (!source) throw new HttpError(400, 'Thiếu dữ liệu hành trình để sao chép.', 'SOURCE_REQUIRED')
  return source
}

async function loadOwn(userId: string, id: string): Promise<ItineraryDocument> {
  const itinerary = isValidObjectId(id) ? await Itinerary.findOne({ _id: id, ownerId: userId }) : null
  if (!itinerary) throw new HttpError(404, 'Không tìm thấy lịch trình.', 'NOT_FOUND')
  return itinerary
}

/** Puts days back in order: renumbered, re-dated, re-totalled. */
async function saveDays(itinerary: ItineraryDocument, days: Record<string, unknown>[]) {
  itinerary.days = days.map((day, i) => ({ ...day, dayNumber: i + 1, date: addDays(itinerary.startDate, i) }))
  itinerary.totalEstCost = totalCostOf(itinerary.days)
  itinerary.markModified('days')
  await itinerary.save()
}

itinerariesRouter.get('/', async (_req, res) => {
  const items = await Itinerary.find({ ownerId: currentUser(res)._id }).sort({ updatedAt: -1 }).limit(200)
  res.json({ items: items.map(itineraryView) })
})

itinerariesRouter.get('/:id', async (req, res) => {
  res.json({ itinerary: itineraryView(await loadOwn(currentUser(res)._id, String(req.params.id))) })
})

const cloneSchema = z.object({
  postId: z.string().min(1).max(80),
  title: z.string().trim().max(150, 'Tên lịch trình tối đa 150 ký tự').optional(),
  startDate: dateOnly.optional(),
  source: sourceSchema.optional(),
})

itinerariesRouter.post('/', writeLimiter, async (req, res) => {
  const input = cloneSchema.parse(req.body)
  const user = currentUser(res)
  const journey = await journeyFor(input.postId, user._id, input.source)

  const id = new Types.ObjectId()
  const startDate = input.startDate ?? journey.startDate
  const days = rekeyDays(journey.days, String(id), startDate)
  const itinerary = await Itinerary.create({
    _id: id,
    ownerId: user._id,
    sourcePostIds: [input.postId],
    cloneType: 'manual',
    title: input.title || `${journey.title} (bản của tôi)`,
    note: `Sao chép từ hành trình “${journey.title}”.`,
    coverUrl: journey.coverUrl,
    startDate,
    days,
    totalEstCost: totalCostOf(days),
  })
  await creditClone([input.postId], user._id)
  res.status(201).json({ itinerary: itineraryView(itinerary) })
})

const orderSchema = z.object({ dayIds: z.array(z.string().max(120)).max(60) })

itinerariesRouter.patch('/:id/days', writeLimiter, async (req, res) => {
  const { dayIds } = orderSchema.parse(req.body)
  const itinerary = await loadOwn(currentUser(res)._id, String(req.params.id))
  const days = itinerary.days as { _id: string }[]
  const byId = new Map(days.map((d) => [d._id, d]))
  const ordered = dayIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  // Days the request left out keep their relative order at the end.
  for (const day of days) if (!dayIds.includes(day._id)) ordered.push(day)
  await saveDays(itinerary, ordered)
  res.json({ itinerary: itineraryView(itinerary) })
})

const mergeSchema = z.object({
  selections: z
    .array(
      z.object({
        postId: z.string().min(1).max(80),
        dayIds: z.array(z.string().max(120)).min(1).max(60),
        source: sourceSchema.optional(),
      }),
    )
    .min(1, 'Hãy chọn ít nhất một ngày để ghép.')
    .max(10),
})

itinerariesRouter.post('/:id/merge', writeLimiter, async (req, res) => {
  const { selections } = mergeSchema.parse(req.body)
  const user = currentUser(res)
  const itinerary = await loadOwn(user._id, String(req.params.id))

  const incoming: unknown[] = []
  for (const selection of selections) {
    const journey = await journeyFor(selection.postId, user._id, selection.source)
    const days = journey.days as { _id: string }[]
    for (const dayId of selection.dayIds) {
      const day = days.find((d) => d._id === dayId)
      if (day) incoming.push(day)
    }
    if (!itinerary.sourcePostIds.includes(selection.postId)) itinerary.sourcePostIds.push(selection.postId)
  }
  if (itinerary.days.length + incoming.length > 60) throw new HttpError(400, 'Lịch trình tối đa 60 ngày.', 'TOO_MANY_DAYS')

  // Merged days take this itinerary's ids, like cloned ones.
  await saveDays(itinerary, rekeyDays([...itinerary.days, ...incoming], String(itinerary._id), itinerary.startDate))
  res.json({ itinerary: itineraryView(itinerary) })
})

itinerariesRouter.delete('/:id/days/:dayId', writeLimiter, async (req, res) => {
  const itinerary = await loadOwn(currentUser(res)._id, String(req.params.id))
  const days = itinerary.days as { _id: string }[]
  if (!days.some((d) => d._id === String(req.params.dayId))) throw new HttpError(404, 'Không tìm thấy ngày này.', 'NOT_FOUND')
  if (days.length <= 1) throw new HttpError(400, 'Lịch trình cần ít nhất một ngày.', 'LAST_DAY')
  await saveDays(itinerary, days.filter((d) => d._id !== String(req.params.dayId)))
  res.json({ itinerary: itineraryView(itinerary) })
})
