/**
 * What ChillnGo sells and what each plan gives. Kept free of the database so
 * the rules can be tested on their own; routes/billing.ts and lib/billing.ts
 * apply them.
 *
 *   Premium (an account):   more AI requests a day, 1080p livestreams,
 *                           replays kept 365 days instead of 30, a crown badge.
 *   Đề xuất (a business):   its page and ad posts are shown in "Gợi ý nổi bật"
 *                           on Discover, marked "Tài trợ".
 *
 * Nothing renews by itself (PayOS takes one payment at a time): each purchase
 * adds its days to whatever time is left.
 */

import { env } from '../env.js'

export const PRODUCT_IDS = ['premium_month', 'premium_year', 'business_boost_month'] as const
export type ProductId = (typeof PRODUCT_IDS)[number]

export type ProductKind = 'premium' | 'boost'

export interface Product {
  id: ProductId
  kind: ProductKind
  /** Shown to the buyer and on the order. */
  name: string
  days: number
  /** VND. */
  amount: number
}

export const PRODUCTS: Record<ProductId, Product> = {
  premium_month: { id: 'premium_month', kind: 'premium', name: 'Premium 1 tháng', days: 30, amount: 49_000 },
  premium_year: { id: 'premium_year', kind: 'premium', name: 'Premium 1 năm', days: 365, amount: 490_000 },
  business_boost_month: {
    id: 'business_boost_month',
    kind: 'boost',
    name: 'Gói Đề xuất 30 ngày',
    days: 30,
    amount: 199_000,
  },
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** Replays of a free account are kept this long after they are ready. */
export const FREE_REPLAY_DAYS = 30
export const PREMIUM_REPLAY_DAYS = 365

/** Livestream video the client publishes. */
export const FREE_LIVE_QUALITY = '720p'
export const PREMIUM_LIVE_QUALITY = '1080p'

/** Premium members are reminded this many days before it runs out. */
export const RENEWAL_REMINDER_DAYS = 3

interface HasPremium {
  premiumUntil?: Date | null
}

/** Whether the account is Premium at `now`. */
export function isPremium(user: HasPremium | null | undefined, now = Date.now()): boolean {
  return Boolean(user?.premiumUntil && user.premiumUntil.getTime() > now)
}

/** AI requests the account may make per day. */
export function aiDailyLimitFor(user: HasPremium | null | undefined, now = Date.now()): number {
  return isPremium(user, now) ? env.aiDailyLimitPremium : env.aiDailyLimit
}

export function replayDaysFor(user: HasPremium | null | undefined, now = Date.now()): number {
  return isPremium(user, now) ? PREMIUM_REPLAY_DAYS : FREE_REPLAY_DAYS
}

export function liveQualityFor(user: HasPremium | null | undefined, now = Date.now()): string {
  return isPremium(user, now) ? PREMIUM_LIVE_QUALITY : FREE_LIVE_QUALITY
}

/**
 * The new end of a plan after buying `days` more: added to the time left, or
 * counted from now when it has already run out (or never started).
 */
export function extendUntil(current: Date | null | undefined, days: number, now = Date.now()): Date {
  const from = current && current.getTime() > now ? current.getTime() : now
  return new Date(from + days * DAY_MS)
}

/** What each plan gives, for the pricing screens. Numbers come from the configuration. */
export function planBenefits() {
  return {
    free: {
      aiDailyLimit: env.aiDailyLimit,
      liveQuality: FREE_LIVE_QUALITY,
      replayDays: FREE_REPLAY_DAYS,
    },
    premium: {
      aiDailyLimit: env.aiDailyLimitPremium,
      liveQuality: PREMIUM_LIVE_QUALITY,
      replayDays: PREMIUM_REPLAY_DAYS,
    },
  }
}
