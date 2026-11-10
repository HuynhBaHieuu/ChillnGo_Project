import { Schema, model } from 'mongoose'

import { moderationField } from './moderation.js'

export const BUSINESS_TYPES = ['homestay', 'hotel', 'restaurant', 'cafe', 'tour'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

/**
 * pending   waiting for an admin; only its owner sees it
 * approved  public: its page, and Discover while the "Đề xuất" package runs
 * rejected  the owner can fix it and send it again (back to pending)
 * hidden    taken down by an admin; only its owner sees it, marked
 */
export const BUSINESS_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number]

/**
 * A homestay, hotel, restaurant, café or tour run by one account (at most one
 * each). The page is free once an admin approves it; paying for "Đề xuất"
 * (`promotedUntil`) puts it, and its ad posts, in Discover's "Gợi ý nổi bật".
 */
const businessSchema = new Schema(
  {
    ownerId: { type: String, required: true, unique: true },
    /** Its address: /b/<slug>. */
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: BUSINESS_TYPES, required: true },
    description: { type: String, default: '' },
    address: { type: String, required: true },
    /** Province or city, for the card. */
    city: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    phone: { type: String, required: true },
    website: { type: String, default: '' },
    photos: { type: [String], default: [] },
    /** VND per person (food) or per night (stay); null when not given. */
    priceFrom: { type: Number, default: null },
    priceTo: { type: Number, default: null },
    openingHours: { type: String, default: '' },
    status: { type: String, enum: BUSINESS_STATUSES, default: 'pending' },
    /** Why an admin rejected or hid it, shown to the owner. */
    statusReason: { type: String, default: '' },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    /** Shown in "Gợi ý nổi bật" until then. */
    promotedUntil: { type: Date, default: null },
    /** Set when reports hide it (lib/reportTargets.ts). */
    moderation: moderationField,
  },
  { timestamps: true, versionKey: false },
)

businessSchema.index({ status: 1, promotedUntil: -1 })
businessSchema.index({ status: 1, createdAt: -1 })

export const Business = model('Business', businessSchema)
export type BusinessDocument = InstanceType<typeof Business>

/**
 * An ad a business writes: an offer, a new room, a seasonal menu. Shown on the
 * business's page, and in Discover while its "Đề xuất" package runs.
 */
const businessPostSchema = new Schema(
  {
    businessId: { type: String, required: true },
    authorId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    photos: { type: [String], default: [] },
    /** A short offer line ("Giảm 20% tháng 12"); empty when none. */
    offer: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
    moderation: moderationField,
  },
  { timestamps: true, versionKey: false },
)

businessPostSchema.index({ businessId: 1, createdAt: -1 })

export const BusinessPost = model('BusinessPost', businessPostSchema)
export type BusinessPostDocument = InstanceType<typeof BusinessPost>
