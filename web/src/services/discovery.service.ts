/**
 * Discover and admin reads.
 *
 * Filtering runs client-side over the fixtures on purpose — when the Express
 * API arrives the same `DiscoverFilters` object becomes the query string and
 * the filtering moves into Mongo, with no change to the calling component.
 */

import { clone, db, delay } from './client'
import { decorate } from './post.service'
import type {
  DiscoverFilters,
  ObjectId,
  TripPostWithAuthor,
  User,
} from './types'

export const DEFAULT_FILTERS: DiscoverFilters = {
  region: 'all',
  season: 'all',
  tags: [],
  budgetLevels: [],
  minCost: 0,
  maxCost: 15_000_000,
  query: '',
}

/** The widest cost any published post reaches — drives the budget slider. */
export function costCeiling(): number {
  const max = db.tripPosts
    .filter((p) => p.status === 'published')
    .reduce((acc, p) => Math.max(acc, p.totalEstCost), 0)
  // Round up to the next 500k so the slider ends on a clean number.
  return Math.ceil(max / 500_000) * 500_000
}

/**
 * GET /api/discover — published posts matching the filters, sorted by bookmark
 * count (most-saved first), which is the ranking the product wants here.
 */
export async function discoverPosts(
  filters: DiscoverFilters,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await delay()

  const query = filters.query.trim().toLowerCase()

  return db.tripPosts
    .filter((p) => p.status === 'published')
    .filter((p) => filters.region === 'all' || p.region === filters.region)
    .filter((p) => filters.season === 'all' || p.season === filters.season)
    .filter(
      (p) => filters.tags.length === 0 || filters.tags.some((t) => p.tags.includes(t)),
    )
    .filter(
      (p) =>
        filters.budgetLevels.length === 0 ||
        filters.budgetLevels.includes(p.budgetLevel),
    )
    .filter((p) => p.totalEstCost >= filters.minCost && p.totalEstCost <= filters.maxCost)
    .filter(
      (p) =>
        query === '' ||
        p.title.toLowerCase().includes(query) ||
        p.summary.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)),
    )
    .sort((a, b) => b.bookmarkCount - a.bookmarkCount)
    .map((p) => decorate(p, viewerId))
}

/** GET /api/tags — every tag in use, most common first. */
export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  await delay()

  const counts = new Map<string, number>()
  for (const post of db.tripPosts) {
    if (post.status !== 'published') continue
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'))
}

/* ----------------------------------------------------------------- admin */

/** GET /api/admin/posts?status=pending — the moderation queue. */
export async function getModerationQueue(): Promise<TripPostWithAuthor[]> {
  await delay()
  return db.tripPosts
    .filter((p) => p.status === 'pending')
    .map((p) => decorate(p, null))
}

/** GET /api/admin/users */
export async function getAllUsers(): Promise<User[]> {
  await delay()
  return db.users.map((u) => clone(u))
}

/** GET /api/admin/stats */
export async function getAdminStats(): Promise<{
  users: number
  published: number
  pending: number
  clones: number
}> {
  await delay()
  return {
    users: db.users.length,
    published: db.tripPosts.filter((p) => p.status === 'published').length,
    pending: db.tripPosts.filter((p) => p.status === 'pending').length,
    clones: db.clonedItineraries.length,
  }
}
