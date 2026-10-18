/**
 * Journeys as cloning sees them: which ones a user may copy from, how copied
 * days are renumbered, and the credit their authors get.
 */

import { HttpError } from './errors.js'
import { notify } from '../models/Notification.js'
import { TripPost } from '../models/TripPost.js'
import type { TripPostDocument } from '../models/TripPost.js'

/** Journeys stored here have ObjectId ids; the web app's sample journeys look like p_001. */
export function isServerPostId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id)
}

/** A journey this user may read and clone: published, or their own. Anything else is a 404. */
export async function readableJourney(id: string, userId: string): Promise<TripPostDocument> {
  const post = isServerPostId(id) ? await TripPost.findById(id) : null
  if (!post || post.deletedAt || (post.status !== 'published' && post.authorId !== userId)) {
    throw new HttpError(404, 'Không tìm thấy hành trình.', 'NOT_FOUND')
  }
  return post
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface DayLike {
  locations?: { estCost?: number }[]
}

/**
 * Days copied into an itinerary: fresh ids, numbered in order and dated on
 * from `startDate`. Everything else (stops, notes, photos) is kept.
 */
export function rekeyDays(days: unknown[], itineraryId: string, startDate: string): Record<string, unknown>[] {
  return (days as (DayLike & Record<string, unknown>)[]).map((day, i) => ({
    ...day,
    _id: `${itineraryId}_d${i + 1}`,
    dayNumber: i + 1,
    date: addDays(startDate, i),
    locations: (day.locations ?? []).map((location, j) => ({ ...location, _id: `${itineraryId}_d${i + 1}_l${j + 1}` })),
  }))
}

export function totalCostOf(days: unknown[]): number {
  return (days as DayLike[]).reduce((sum, day) => sum + (day.locations ?? []).reduce((s, l) => s + (l.estCost ?? 0), 0), 0)
}

/** One more clone on each of these journeys (those stored here), and a word to their authors. */
export async function creditClone(postIds: string[], userId: string, how = ''): Promise<void> {
  const ids = postIds.filter(isServerPostId)
  if (ids.length === 0) return
  await TripPost.updateMany({ _id: { $in: ids } }, { $inc: { cloneCount: 1 } })
  const posts = await TripPost.find({ _id: { $in: ids } }).select('title authorId').lean()
  for (const post of posts) {
    if (post.authorId === userId) continue
    const title = post.title.length > 50 ? `${post.title.slice(0, 49)}…` : post.title
    await notify([post.authorId], {
      type: 'clone',
      actorId: userId,
      postId: String(post._id),
      message: `đã clone hành trình “${title || 'của bạn'}”${how}`,
    })
  }
}
