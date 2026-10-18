/**
 * Shapes of what comes in: the AI clone form from the browser, and the plan or
 * patches from the model. Model output objects are strict, so a stop that
 * carries a free-text place (a `name` instead of an id) is rejected, not
 * quietly trimmed.
 */

import { z } from 'zod'

import { PLACE_CATEGORIES } from '../models/Place.js'
import type { PlaceCategory } from '../models/Place.js'

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as [PlaceCategory, ...PlaceCategory[]]

export const formSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày khởi hành không hợp lệ')
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), 'Ngày khởi hành không hợp lệ'),
  days: z.number('Hãy nhập số ngày').int().min(1, 'Ít nhất 1 ngày').max(14, 'Tối đa 14 ngày'),
  groupSize: z.number('Hãy nhập số người').int().min(1, 'Ít nhất 1 người').max(30, 'Tối đa 30 người'),
  withChildren: z.boolean().default(false),
  withElderly: z.boolean().default(false),
  /** Whole trip, whole group, VND. Null: no budget. */
  budget: z.number().int().min(0).max(10_000_000_000, 'Ngân sách quá lớn').nullable().default(null),
  departure: z.string().trim().max(100, 'Điểm xuất phát tối đa 100 ký tự').default(''),
  interests: z.array(z.enum(CATEGORY_KEYS, 'Sở thích không hợp lệ')).max(12).default([]),
  pace: z.enum(['relaxed', 'moderate', 'packed'], 'Nhịp độ không hợp lệ').default('moderate'),
})

export type FormInput = z.infer<typeof formSchema>

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be "HH:mm", 24-hour')
const duration = z.number().int().min(15).max(600)
const reason = z.string().trim().min(1).max(300)

/** The model's itinerary: ids only (P… places, S… stops of the source journey), never place data. */
export const planSchema = z.strictObject({
  days: z.array(
    z.strictObject({
      dayIndex: z.number().int(),
      stops: z.array(
        z.strictObject({
          placeId: z.string(),
          startTime: time,
          durationMin: duration,
          action: z.enum(['keep', 'replace', 'add']),
          sourceStopId: z.string().nullish(),
          reason,
        }),
      ),
    }),
  ),
  removed: z.array(z.strictObject({ sourceStopId: z.string(), reason })).default([]),
})

export type Plan = z.infer<typeof planSchema>

/** One edit the chat asks for. `stopId` names a stop of the draft (c…), `placeId` a candidate (P…). */
export const patchSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('add'),
    placeId: z.string(),
    dayIndex: z.number().int(),
    startTime: time,
    durationMin: duration,
    reason,
  }),
  z.strictObject({ op: z.literal('remove'), stopId: z.string(), reason }),
  z.strictObject({ op: z.literal('replace'), stopId: z.string(), placeId: z.string(), reason }),
  z.strictObject({
    op: z.literal('move'),
    stopId: z.string(),
    dayIndex: z.number().int(),
    startTime: time,
    reason: reason.optional(),
  }),
  z.strictObject({
    op: z.literal('retime'),
    stopId: z.string(),
    startTime: time,
    durationMin: duration,
    reason: reason.optional(),
  }),
])

export type Patch = z.infer<typeof patchSchema>

export const chatOutputSchema = z.strictObject({
  reply: z.string().trim().min(1).max(800),
  patches: z.array(patchSchema).max(20),
})

export type ChatOutput = z.infer<typeof chatOutputSchema>
