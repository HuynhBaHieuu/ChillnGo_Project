/**
 * Cloned itineraries.
 *
 * The clone and reorder operations here are deliberate stubs: a clone is a deep
 * copy with fresh ids and re-based dates, and a reorder is an array move. The
 * real algorithms (route re-optimisation, date/travel-time reconciliation,
 * conflict resolution when merging two posts) land with the Express API.
 */

import { assertFound, clone, db, delay, nextId, nowIso } from './client'
import { totalCostOf } from '@/lib/itinerary'
import type {
  ClonedItinerary,
  ObjectId,
  TripDay,
  TripPost,
} from './types'

/** Add `days` calendar days to a `YYYY-MM-DD` string, staying in UTC. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Re-key a set of days onto a new itinerary: fresh ids, sequential day numbers
 * and dates counted forward from `startDate`.
 */
function rekeyDays(days: TripDay[], itineraryId: ObjectId, startDate: string): TripDay[] {
  return days.map((day, i) => ({
    ...clone(day),
    _id: `${itineraryId}_d${i + 1}`,
    dayNumber: i + 1,
    date: addDays(startDate, i),
    locations: day.locations.map((loc, j) => ({
      ...clone(loc),
      _id: `${itineraryId}_d${i + 1}_l${j + 1}`,
    })),
  }))
}

/** GET /api/itineraries */
export async function getMyItineraries(ownerId: ObjectId): Promise<ClonedItinerary[]> {
  await delay()
  return db.clonedItineraries
    .filter((it) => it.ownerId === ownerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((it) => clone(it))
}

/** GET /api/itineraries/:id */
export async function getItineraryById(id: ObjectId): Promise<ClonedItinerary> {
  await delay()
  return clone(
    assertFound(
      db.clonedItineraries.find((it) => it._id === id),
      `Không tìm thấy lịch trình ${id}`,
    ),
  )
}

/**
 * POST /api/posts/:id/clone — the core action of the product.
 *
 * Copies every day of a post into a new itinerary owned by the viewer, starting
 * on `startDate` (defaults to the source post's own start date).
 */
export async function clonePost(input: {
  postId: ObjectId
  ownerId: ObjectId
  title?: string
  startDate?: string
}): Promise<ClonedItinerary> {
  await delay()

  const post: TripPost = assertFound(
    db.tripPosts.find((p) => p._id === input.postId),
    `Không tìm thấy bài viết ${input.postId}`,
  )

  const id = nextId('ci')
  const startDate = input.startDate ?? post.startDate
  const days = rekeyDays(post.days, id, startDate)

  const itinerary: ClonedItinerary = {
    _id: id,
    ownerId: input.ownerId,
    sourcePostIds: [post._id],
    title: input.title?.trim() || `${post.title} (bản của tôi)`,
    note: `Clone từ bài viết "${post.title}".`,
    coverUrl: post.coverUrl,
    startDate,
    days,
    totalEstCost: totalCostOf(days),
    status: 'planning',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  db.clonedItineraries.unshift(itinerary)
  post.cloneCount += 1

  return clone(itinerary)
}

/**
 * PATCH /api/itineraries/:id/days — persist a new day order.
 *
 * Stub: the caller has already moved the array, so this renumbers, re-bases the
 * dates and recomputes the total. No route re-optimisation yet.
 */
export async function reorderItineraryDays(
  id: ObjectId,
  orderedDayIds: ObjectId[],
): Promise<ClonedItinerary> {
  await delay()

  const itinerary = assertFound(
    db.clonedItineraries.find((it) => it._id === id),
    `Không tìm thấy lịch trình ${id}`,
  )

  const byId = new Map(itinerary.days.map((d) => [d._id, d]))
  const reordered = orderedDayIds
    .map((dayId) => byId.get(dayId))
    .filter((d): d is TripDay => Boolean(d))

  // Anything the caller left out keeps its relative position at the end.
  for (const day of itinerary.days) {
    if (!orderedDayIds.includes(day._id)) reordered.push(day)
  }

  itinerary.days = reordered.map((day, i) => ({
    ...day,
    dayNumber: i + 1,
    date: addDays(itinerary.startDate, i),
  }))
  itinerary.totalEstCost = totalCostOf(itinerary.days)
  itinerary.updatedAt = nowIso()

  return clone(itinerary)
}

/**
 * POST /api/itineraries/:id/merge — append selected days from other posts.
 *
 * Stub: days are appended in the order given and renumbered. The real version
 * will interleave by geography and flag date conflicts.
 */
export async function mergeIntoItinerary(input: {
  itineraryId: ObjectId
  selections: { postId: ObjectId; dayIds: ObjectId[] }[]
}): Promise<ClonedItinerary> {
  await delay()

  const itinerary = assertFound(
    db.clonedItineraries.find((it) => it._id === input.itineraryId),
    `Không tìm thấy lịch trình ${input.itineraryId}`,
  )

  const incoming: TripDay[] = []
  for (const selection of input.selections) {
    const post = db.tripPosts.find((p) => p._id === selection.postId)
    if (!post) continue

    for (const dayId of selection.dayIds) {
      const day = post.days.find((d) => d._id === dayId)
      if (day) incoming.push(day)
    }

    if (!itinerary.sourcePostIds.includes(post._id)) {
      itinerary.sourcePostIds.push(post._id)
    }
  }

  const merged = [...itinerary.days, ...incoming]
  itinerary.days = merged.map((day, i) => ({
    ...clone(day),
    _id: `${itinerary._id}_d${i + 1}`,
    dayNumber: i + 1,
    date: addDays(itinerary.startDate, i),
    locations: day.locations.map((loc, j) => ({
      ...clone(loc),
      _id: `${itinerary._id}_d${i + 1}_l${j + 1}`,
    })),
  }))
  itinerary.totalEstCost = totalCostOf(itinerary.days)
  itinerary.updatedAt = nowIso()

  return clone(itinerary)
}

/** DELETE /api/itineraries/:id/days/:dayId */
export async function removeItineraryDay(
  id: ObjectId,
  dayId: ObjectId,
): Promise<ClonedItinerary> {
  await delay()

  const itinerary = assertFound(
    db.clonedItineraries.find((it) => it._id === id),
    `Không tìm thấy lịch trình ${id}`,
  )

  itinerary.days = itinerary.days
    .filter((d) => d._id !== dayId)
    .map((day, i) => ({
      ...day,
      dayNumber: i + 1,
      date: addDays(itinerary.startDate, i),
    }))
  itinerary.totalEstCost = totalCostOf(itinerary.days)
  itinerary.updatedAt = nowIso()

  return clone(itinerary)
}
