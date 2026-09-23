/**
 * Home page reads.
 *
 * Everything here is an aggregate over published trip posts. The real API will
 * serve these precomputed (GET /api/landing/*); the mock computes them from the
 * fixtures on each call.
 */

import { clone, db, delay } from './client'
import type { DestinationRow, LandingStats, TripPost } from './types'

function published(): TripPost[] {
  return db.tripPosts.filter((p) => p.status === 'published')
}

/** "Hà Giang Loop 4N3Đ — cung đường đá và mây" → "Hà Giang Loop 4N3Đ" */
function shortTitle(title: string): string {
  return title.split(' — ')[0].trim()
}

/** GET /api/landing/stats */
export async function getLandingStats(): Promise<LandingStats> {
  await delay()
  const posts = published()
  return {
    tripCount: posts.length,
    cloneCount: posts.reduce((sum, p) => sum + p.cloneCount, 0),
    bookmarkCount: posts.reduce((sum, p) => sum + p.bookmarkCount, 0),
    stopCount: posts.reduce(
      (sum, p) => sum + p.days.reduce((n, d) => n + d.locations.length, 0),
      0,
    ),
  }
}

/** GET /api/landing/destinations — every stop of every published trip, in trip order. */
export async function getDestinationRows(): Promise<DestinationRow[]> {
  await delay()
  return published().flatMap((post) =>
    post.days.flatMap((day) =>
      day.locations.map((loc) => ({
        id: loc._id,
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        postId: post._id,
        tripTitle: shortTitle(post.title),
      })),
    ),
  )
}

/**
 * GET /api/landing/moments — trip photos for the home page photo wheel.
 *
 * Taken round-robin across trips so neighbouring photos on the wheel come from
 * different journeys.
 */
export async function getMomentPhotos(limit: number): Promise<string[]> {
  await delay()
  const perPost = published().map((p) => p.days.flatMap((d) => d.photos))
  const out: string[] = []

  for (let i = 0; out.length < limit; i += 1) {
    let added = false
    for (const photos of perPost) {
      if (i < photos.length && out.length < limit) {
        out.push(photos[i])
        added = true
      }
    }
    if (!added) break
  }

  return clone(out)
}
