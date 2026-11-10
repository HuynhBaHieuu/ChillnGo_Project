/**
 * Business pages and their ad posts: input rules, who sees what, and the JSON
 * the API sends. routes/businesses.ts and routes/admin.ts use these.
 */

import { z } from 'zod'

import { isModerated, moderationView } from '../models/moderation.js'
import { BUSINESS_TYPES } from '../models/Business.js'
import type { BusinessDocument, BusinessPostDocument } from '../models/Business.js'

export const MAX_BUSINESS_PHOTOS = 8
export const MAX_POST_PHOTOS = 6

const photoUrl = z.url('Ảnh không hợp lệ').max(500).refine((url) => url.startsWith('https://'), 'Ảnh không hợp lệ')

const optionalPrice = z
  .number('Giá không hợp lệ')
  .int('Giá không hợp lệ')
  .min(0, 'Giá không hợp lệ')
  .max(1_000_000_000, 'Giá không hợp lệ')
  .nullable()
  .default(null)

export const businessInputSchema = z
  .object({
    name: z.string('Vui lòng nhập tên cơ sở').trim().min(2, 'Tên cơ sở tối thiểu 2 ký tự').max(80, 'Tên cơ sở tối đa 80 ký tự'),
    type: z.enum(BUSINESS_TYPES, 'Loại hình không hợp lệ'),
    description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').default(''),
    address: z.string('Vui lòng nhập địa chỉ').trim().min(5, 'Vui lòng nhập địa chỉ').max(200, 'Địa chỉ tối đa 200 ký tự'),
    city: z.string().trim().max(60, 'Tỉnh/thành tối đa 60 ký tự').default(''),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    phone: z
      .string('Vui lòng nhập số điện thoại')
      .trim()
      .regex(/^\+?[0-9 .-]{8,15}$/, 'Số điện thoại không hợp lệ'),
    website: z.union([z.literal(''), z.url('Website không hợp lệ').max(300)]).default(''),
    photos: z.array(photoUrl).max(MAX_BUSINESS_PHOTOS, `Tối đa ${MAX_BUSINESS_PHOTOS} ảnh`).default([]),
    priceFrom: optionalPrice,
    priceTo: optionalPrice,
    openingHours: z.string().trim().max(100, 'Giờ mở cửa tối đa 100 ký tự').default(''),
  })
  .refine((b) => b.priceFrom === null || b.priceTo === null || b.priceFrom <= b.priceTo, {
    message: 'Giá thấp nhất phải nhỏ hơn giá cao nhất.',
    path: ['priceTo'],
  })

export type BusinessInput = z.infer<typeof businessInputSchema>

export const businessPostInputSchema = z.object({
  title: z.string('Vui lòng nhập tiêu đề').trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(120, 'Tiêu đề tối đa 120 ký tự'),
  content: z.string('Vui lòng nhập nội dung').trim().min(10, 'Nội dung tối thiểu 10 ký tự').max(3000, 'Nội dung tối đa 3000 ký tự'),
  photos: z.array(photoUrl).max(MAX_POST_PHOTOS, `Tối đa ${MAX_POST_PHOTOS} ảnh`).default([]),
  offer: z.string().trim().max(80, 'Ưu đãi tối đa 80 ký tự').default(''),
})

export const reviewSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'hide', 'restore'], 'Quyết định không hợp lệ'),
    reason: z.string().trim().max(500, 'Lý do tối đa 500 ký tự').default(''),
  })
  .refine((r) => !(r.action === 'reject' || r.action === 'hide') || r.reason.length > 0, {
    message: 'Hãy ghi lý do để chủ cơ sở biết cần sửa gì.',
    path: ['reason'],
  })

/** The address part of a business page: "Homestay Mây Đà Lạt" → "homestay-may-da-lat". */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return base || 'co-so'
}

/** Whether the "Đề xuất" package runs at `now`. */
export function isPromoted(business: { promotedUntil?: Date | null }, now = Date.now()): boolean {
  return Boolean(business.promotedUntil && business.promotedUntil.getTime() > now)
}

/** Whether everyone may see the business (approved, not hidden after reports). */
export function isPublic(business: { status: string; moderation?: { hidden?: boolean | null } | null }): boolean {
  return business.status === 'approved' && !isModerated(business.moderation)
}

/** Shown in "Gợi ý nổi bật": public and paid up. */
export function isSponsored(
  business: { status: string; promotedUntil?: Date | null; moderation?: { hidden?: boolean | null } | null },
  now = Date.now(),
): boolean {
  return isPublic(business) && isPromoted(business, now)
}

export function businessView(business: BusinessDocument, opts: { owner: boolean }) {
  return {
    _id: String(business._id),
    ownerId: business.ownerId,
    slug: business.slug,
    name: business.name,
    type: business.type,
    description: business.description,
    address: business.address,
    city: business.city,
    lat: business.lat ?? null,
    lng: business.lng ?? null,
    phone: business.phone,
    website: business.website,
    photos: business.photos,
    priceFrom: business.priceFrom ?? null,
    priceTo: business.priceTo ?? null,
    openingHours: business.openingHours,
    sponsored: isSponsored(business),
    createdAt: business.createdAt.toISOString(),
    // Only the owner learns where review stands and how long the package runs.
    ...(opts.owner && {
      status: business.status,
      statusReason: business.statusReason,
      promotedUntil: business.promotedUntil?.toISOString() ?? null,
      moderation: moderationView(business.moderation),
    }),
  }
}

export function businessPostView(post: BusinessPostDocument, opts: { owner: boolean }) {
  return {
    _id: String(post._id),
    businessId: post.businessId,
    title: post.title,
    content: post.content,
    photos: post.photos,
    offer: post.offer,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    ...(opts.owner && { moderation: moderationView(post.moderation) }),
  }
}

/** Fisher–Yates, so no paying business always sits first. */
export function shuffled<T>(items: T[], random = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
