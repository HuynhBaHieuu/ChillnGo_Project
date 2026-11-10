/**
 * /api/admin/catalog — [categories]. Destinations, their places and the
 * preparation checklist: the data AI clone plans from. Needs a signed-in,
 * unlocked staff account with the categories module.
 *
 * Edits replace the whole record (PUT), so a form sends every field. Every
 * change is written to the audit log. Nothing still in use is deleted: a
 * destination with places, or a place a journey links to, is refused.
 */

import { Router } from 'express'
import type { Request } from 'express'
import { Types, isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { audit } from '../lib/audit.js'
import { catalogMeta, checklistSchema, destinationSchema, placeSchema } from '../lib/catalog.js'
import { HttpError, duplicateKeyField } from '../lib/errors.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser, requirePermission, requireStaff } from '../middleware/staff.js'
import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import { Destination } from '../models/Destination.js'
import { PLACE_CATEGORIES, Place } from '../models/Place.js'
import { TripPost } from '../models/TripPost.js'

export const catalogRouter = Router()
catalogRouter.use(requireAuth, loadCurrentUser, requireStaff, requirePermission('categories'))

const PAGE_SIZE = 20

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function idParam(req: Request, notFound: string): string {
  const id = String(req.params.id)
  if (!isValidObjectId(id)) throw new HttpError(404, notFound, 'NOT_FOUND')
  return id
}

/** Journeys whose stops link to this place (seeded ones store the id as a string). */
function journeysUsing(placeId: string): Promise<number> {
  return TripPost.countDocuments({
    'days.locations.placeId': { $in: [placeId, new Types.ObjectId(placeId)] },
  })
}

function viewOf<T extends { _id: unknown; createdAt?: Date; updatedAt?: Date }>(doc: T) {
  return {
    ...doc,
    _id: String(doc._id),
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  }
}

/* ------------------------------------------------------------------- meta */

/** GET /catalog/meta — place categories and the tag vocabularies. */
catalogRouter.get('/meta', (_req, res) => {
  res.json(catalogMeta())
})

/* ----------------------------------------------------------- destinations */

/** GET /catalog/destinations — all of them (a short list), with their place counts. */
catalogRouter.get('/destinations', async (_req, res) => {
  const [destinations, counts] = await Promise.all([
    Destination.find().sort({ name: 1 }).lean(),
    Place.aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: '$destinationId', n: { $sum: 1 } } }]),
  ])
  const byId = new Map(counts.map((c) => [String(c._id), c.n]))
  res.json({
    items: destinations.map((d) => ({
      ...viewOf(d),
      festivals: (d.festivals ?? []).map((f) => ({ name: f.name ?? '', month: f.month ?? 1 })),
      placeCount: byId.get(String(d._id)) ?? 0,
    })),
  })
})

async function saveDestination(id: string | null, req: Request) {
  const input = destinationSchema.parse(req.body)
  try {
    if (!id) return await Destination.create(input)
    const updated = await Destination.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
    if (!updated) throw new HttpError(404, 'Không tìm thấy điểm đến.', 'NOT_FOUND')
    return updated
  } catch (error) {
    if (duplicateKeyField(error) === 'slug') throw new HttpError(409, 'Mã đường dẫn này đã có điểm đến khác dùng.')
    throw error
  }
}

/** POST /catalog/destinations */
catalogRouter.post('/destinations', async (req, res) => {
  const destination = await saveDestination(null, req)
  await audit(req, currentUser(res), 'catalog.destination.create', {
    type: 'destination',
    id: String(destination._id),
    label: destination.name,
  })
  res.status(201).json({ destination: viewOf(destination.toObject()) })
})

/** PUT /catalog/destinations/:id */
catalogRouter.put('/destinations/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy điểm đến.')
  const destination = await saveDestination(id, req)
  await audit(req, currentUser(res), 'catalog.destination.update', { type: 'destination', id, label: destination.name })
  res.json({ destination: viewOf(destination.toObject()) })
})

/** DELETE /catalog/destinations/:id — only once it has no places left. */
catalogRouter.delete('/destinations/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy điểm đến.')
  const destination = await Destination.findById(id)
  if (!destination) throw new HttpError(404, 'Không tìm thấy điểm đến.', 'NOT_FOUND')
  const places = await Place.countDocuments({ destinationId: id })
  if (places > 0) {
    throw new HttpError(409, `Điểm đến này còn ${places} địa điểm. Hãy xoá hoặc chuyển chúng sang điểm đến khác trước.`, 'IN_USE')
  }
  await destination.deleteOne()
  await audit(req, currentUser(res), 'catalog.destination.delete', { type: 'destination', id, label: destination.name })
  res.json({ ok: true })
})

/* ----------------------------------------------------------------- places */

const placeQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  destinationId: z.string().regex(/^[a-f0-9]{24}$/i).optional().catch(undefined),
  category: z.enum(Object.keys(PLACE_CATEGORIES) as [string, ...string[]]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

/** GET /catalog/places?q&destinationId&category&page */
catalogRouter.get('/places', async (req, res) => {
  const query = placeQuerySchema.parse(req.query)
  const filter: Record<string, unknown> = {}
  if (query.destinationId) filter.destinationId = query.destinationId
  if (query.category) filter.category = query.category
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ name: pattern }, { address: pattern }]
  }

  const [items, total] = await Promise.all([
    Place.find(filter)
      .sort({ name: 1 })
      .skip((query.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Place.countDocuments(filter),
  ])
  res.json({
    items: items.map((p) => ({ ...viewOf(p), destinationId: String(p.destinationId) })),
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
  })
})

async function placeInput(req: Request) {
  const input = placeSchema.parse(req.body)
  if (!(await Destination.exists({ _id: input.destinationId }))) {
    throw new HttpError(400, 'Điểm đến đã chọn không còn tồn tại.', 'INVALID_DESTINATION')
  }
  return input
}

/** POST /catalog/places */
catalogRouter.post('/places', async (req, res) => {
  const place = await Place.create(await placeInput(req))
  await audit(req, currentUser(res), 'catalog.place.create', { type: 'place', id: String(place._id), label: place.name })
  res.status(201).json({ place: { ...viewOf(place.toObject()), destinationId: String(place.destinationId) } })
})

/** PUT /catalog/places/:id */
catalogRouter.put('/places/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy địa điểm.')
  const input = await placeInput(req)
  const place = await Place.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
  if (!place) throw new HttpError(404, 'Không tìm thấy địa điểm.', 'NOT_FOUND')
  await audit(req, currentUser(res), 'catalog.place.update', { type: 'place', id, label: place.name })
  res.json({ place: { ...viewOf(place.toObject()), destinationId: String(place.destinationId) } })
})

/** DELETE /catalog/places/:id — refused while a journey links to it. */
catalogRouter.delete('/places/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy địa điểm.')
  const place = await Place.findById(id)
  if (!place) throw new HttpError(404, 'Không tìm thấy địa điểm.', 'NOT_FOUND')
  const journeys = await journeysUsing(id)
  if (journeys > 0) {
    throw new HttpError(409, `Có ${journeys} hành trình đang dùng địa điểm này nên không xoá được. Hãy sửa thông tin thay vì xoá.`, 'IN_USE')
  }
  await place.deleteOne()
  await audit(req, currentUser(res), 'catalog.place.delete', { type: 'place', id, label: place.name })
  res.json({ ok: true })
})

/* -------------------------------------------------------------- checklist */

/** GET /catalog/checklist — every item, by group then position. */
catalogRouter.get('/checklist', async (_req, res) => {
  const items = await ChecklistTemplate.find().sort({ group: 1, order: 1, text: 1 }).lean()
  res.json({ items: items.map(viewOf) })
})

/** POST /catalog/checklist */
catalogRouter.post('/checklist', async (req, res) => {
  const item = await ChecklistTemplate.create(checklistSchema.parse(req.body))
  await audit(req, currentUser(res), 'catalog.checklist.create', { type: 'checklist', id: String(item._id), label: item.text })
  res.status(201).json({ item: viewOf(item.toObject()) })
})

/** PUT /catalog/checklist/:id */
catalogRouter.put('/checklist/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy mục chuẩn bị.')
  const item = await ChecklistTemplate.findByIdAndUpdate(id, { $set: checklistSchema.parse(req.body) }, { new: true })
  if (!item) throw new HttpError(404, 'Không tìm thấy mục chuẩn bị.', 'NOT_FOUND')
  await audit(req, currentUser(res), 'catalog.checklist.update', { type: 'checklist', id, label: item.text })
  res.json({ item: viewOf(item.toObject()) })
})

/** DELETE /catalog/checklist/:id */
catalogRouter.delete('/checklist/:id', async (req, res) => {
  const id = idParam(req, 'Không tìm thấy mục chuẩn bị.')
  const item = await ChecklistTemplate.findByIdAndDelete(id)
  if (!item) throw new HttpError(404, 'Không tìm thấy mục chuẩn bị.', 'NOT_FOUND')
  await audit(req, currentUser(res), 'catalog.checklist.delete', { type: 'checklist', id, label: item.text })
  res.json({ ok: true })
})
