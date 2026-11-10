/**
 * The catalog the AI plans from: destinations, their places, and the
 * preparation checklist. Admins with the `categories` module edit it
 * (routes/adminCatalog.ts); scripts/seed-places.ts seeds it.
 *
 * Place categories stay a fixed list (PLACE_CATEGORIES): the AI's output
 * schema is built from it. Tags are free-form but checked against the
 * vocabularies below, so a typo never silently stops matching.
 */

import { z } from 'zod'

import { PLACE_CATEGORIES } from '../models/Place.js'
import type { PlaceCategory } from '../models/Place.js'

/** Place.tags: what kind of trip a visit makes it. */
export const PLACE_TAGS = ['beach', 'mountain', 'temple', 'water'] as const

/** ChecklistTemplate.tags: every trip tag ai/checklist.ts can produce. */
export const CHECKLIST_TAGS = [
  'all',
  ...(Object.keys(PLACE_CATEGORIES) as PlaceCategory[]),
  ...PLACE_TAGS,
  'outdoor',
  'rainy',
  'peak',
  'kids',
  'elderly',
] as const

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as [PlaceCategory, ...PlaceCategory[]]

const text = (max: number, required: string) =>
  z.string(required).trim().min(1, required).max(max, `Tối đa ${max} ký tự`)

const months = z
  .array(z.number().int().min(1, 'Tháng từ 1 đến 12').max(12, 'Tháng từ 1 đến 12'))
  .max(12)
  .transform((list) => [...new Set(list)].sort((a, b) => a - b))

const latitude = z.number('Vĩ độ không hợp lệ').min(-90, 'Vĩ độ không hợp lệ').max(90, 'Vĩ độ không hợp lệ')
const longitude = z.number('Kinh độ không hợp lệ').min(-180, 'Kinh độ không hợp lệ').max(180, 'Kinh độ không hợp lệ')

export const destinationSchema = z.object({
  slug: z
    .string('Vui lòng nhập mã đường dẫn')
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Mã đường dẫn chỉ gồm chữ không dấu, số và dấu gạch ngang, ví dụ da-lat'),
  name: text(80, 'Vui lòng nhập tên điểm đến'),
  region: text(80, 'Vui lòng nhập vùng / tỉnh'),
  lat: latitude,
  lng: longitude,
  radiusKm: z.number('Bán kính không hợp lệ').min(1, 'Bán kính từ 1 đến 200 km').max(200, 'Bán kính từ 1 đến 200 km'),
  rainyMonths: months.default([]),
  peakMonths: months.default([]),
  festivals: z
    .array(z.object({ name: text(80, 'Vui lòng nhập tên lễ hội'), month: z.number().int().min(1).max(12) }))
    .max(30)
    .default([]),
})
export type DestinationInput = z.infer<typeof destinationSchema>

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const time = z.string().regex(HHMM, 'Giờ theo dạng HH:MM, ví dụ 07:30')

/** Every fact may be null: unknown stays unknown, it is never estimated. */
export const placeSchema = z.object({
  destinationId: z.string('Vui lòng chọn điểm đến').regex(/^[a-f0-9]{24}$/i, 'Vui lòng chọn điểm đến'),
  name: text(120, 'Vui lòng nhập tên địa điểm'),
  address: z.string().trim().max(200, 'Tối đa 200 ký tự').default(''),
  lat: latitude.nullable().default(null),
  lng: longitude.nullable().default(null),
  category: z.enum(CATEGORY_KEYS, 'Loại địa điểm không hợp lệ').nullable().default(null),
  avgCost: z.number().int('Chi phí là số nguyên (VND)').min(0, 'Chi phí không được âm').max(100_000_000).nullable().default(null),
  priceLevel: z.number().int().min(1, 'Mức giá từ 1 đến 4').max(4, 'Mức giá từ 1 đến 4').nullable().default(null),
  openingHours: z.object({ open: time, close: time }).nullable().default(null),
  isOutdoor: z.boolean().nullable().default(null),
  requiresBooking: z.boolean().nullable().default(null),
  rating: z.number().min(0, 'Điểm đánh giá từ 0 đến 5').max(5, 'Điểm đánh giá từ 0 đến 5').nullable().default(null),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((url) => url === '' || /^https?:\/\//.test(url), 'Ảnh phải là đường dẫn http(s)')
    .transform((url) => url || null)
    .nullable()
    .default(null),
  tags: z
    .array(z.enum(PLACE_TAGS, 'Tag địa điểm không hợp lệ'))
    .max(PLACE_TAGS.length)
    .transform((list) => [...new Set(list)])
    .default([]),
}).refine((place) => (place.lat === null) === (place.lng === null), {
  message: 'Nhập cả vĩ độ và kinh độ, hoặc để trống cả hai',
  path: ['lat'],
})
export type PlaceInput = z.infer<typeof placeSchema>

export const checklistSchema = z.object({
  text: text(200, 'Vui lòng nhập nội dung'),
  group: text(40, 'Vui lòng nhập nhóm, ví dụ Giấy tờ'),
  tags: z
    .array(z.enum(CHECKLIST_TAGS, 'Tag không hợp lệ'))
    .min(1, 'Chọn ít nhất một tag')
    .max(CHECKLIST_TAGS.length)
    .transform((list) => [...new Set(list)]),
  order: z.number().int().min(0).max(10_000).default(0),
})
export type ChecklistInput = z.infer<typeof checklistSchema>

/** What the admin screens need to fill their pickers. */
export function catalogMeta() {
  return {
    categories: CATEGORY_KEYS.map((key) => ({ key, label: PLACE_CATEGORIES[key] })),
    placeTags: [...PLACE_TAGS],
    checklistTags: [...CHECKLIST_TAGS],
  }
}
