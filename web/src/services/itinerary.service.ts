/**
 * Cloned itineraries ("Đã clone về"), stored by the API
 * (server/src/routes/itineraries.ts) and private to their owner.
 *
 * The sample journeys (ids like p_001) exist only here in the browser, so
 * cloning or merging one sends its days along; the API reads its own journeys
 * itself. `ownerId` parameters stay for the callers' sake: the API knows who
 * is asking.
 */

import { assertFound, db } from './client'
import { http } from './http'
import { isServerPostId, syncServerPosts } from './serverPosts'
import type { ClonedItinerary, ObjectId } from './types'
import { themeFromText, travelCover } from '@/lib/photos'

type ItineraryResponse = { itinerary: ClonedItinerary }

/** The source's cover, or the automatic one a journey without photos gets. */
function withCover(itinerary: ClonedItinerary): ClonedItinerary {
  if (itinerary.coverUrl) return itinerary
  return { ...itinerary, coverUrl: travelCover(itinerary.title.slice(0, 30) || 'chillngo', themeFromText(itinerary.title)) }
}

/** A sample journey's days as this browser has them; nothing for a journey the API stores. */
function sampleSource(postId: ObjectId, dayIds?: ObjectId[]) {
  if (isServerPostId(postId)) return undefined
  const post = assertFound(
    db.tripPosts.find((p) => p._id === postId),
    `Không tìm thấy bài viết ${postId}`,
  )
  return {
    title: post.title,
    coverUrl: post.coverUrl,
    startDate: post.startDate,
    days: dayIds ? post.days.filter((d) => dayIds.includes(d._id)) : post.days,
  }
}

/** GET /api/itineraries */
export async function getMyItineraries(_ownerId: ObjectId): Promise<ClonedItinerary[]> {
  const { items } = await http<{ items: ClonedItinerary[] }>('/api/itineraries')
  return items.map(withCover)
}

/**
 * GET /api/itineraries/:id, with the journeys it came from and their authors
 * (for "Phỏng theo hành trình của @…"). Someone else's answers "not found".
 */
export async function getItineraryById(id: ObjectId, _ownerId: ObjectId): Promise<ClonedItinerary> {
  const [{ itinerary }] = await Promise.all([http<ItineraryResponse>(`/api/itineraries/${id}`), syncServerPosts()])
  return {
    ...withCover(itinerary),
    sources: itinerary.sourcePostIds.map((postId) => {
      const post = db.tripPosts.find((p) => p._id === postId)
      const author = post ? db.users.find((u) => u._id === post.authorId) : undefined
      return {
        postId,
        title: post?.title ?? '',
        author: author ? { _id: author._id, username: author.username, displayName: author.displayName } : null,
      }
    }),
  }
}

/**
 * POST /api/itineraries — the core action of the product: copies every day of
 * a journey into a new itinerary you own, dated from `startDate` (default: the
 * journey's own).
 */
export async function clonePost(input: {
  postId: ObjectId
  ownerId: ObjectId
  title?: string
  startDate?: string
}): Promise<ClonedItinerary> {
  const { itinerary } = await http<ItineraryResponse>('/api/itineraries', {
    method: 'POST',
    body: { postId: input.postId, title: input.title, startDate: input.startDate, source: sampleSource(input.postId) },
  })
  // The API counted it on its own journeys; this keeps the open page in step until the next sync.
  const post = db.tripPosts.find((p) => p._id === input.postId)
  if (post) post.cloneCount += 1
  return withCover(itinerary)
}

/** PATCH /api/itineraries/:id/days — a new day order; days are renumbered and re-dated. */
export async function reorderItineraryDays(
  id: ObjectId,
  orderedDayIds: ObjectId[],
  _ownerId: ObjectId,
): Promise<ClonedItinerary> {
  const { itinerary } = await http<ItineraryResponse>(`/api/itineraries/${id}/days`, {
    method: 'PATCH',
    body: { dayIds: orderedDayIds },
  })
  return withCover(itinerary)
}

/** POST /api/itineraries/:id/merge — appends the chosen days of other journeys, in order. */
export async function mergeIntoItinerary(input: {
  itineraryId: ObjectId
  ownerId: ObjectId
  selections: { postId: ObjectId; dayIds: ObjectId[] }[]
}): Promise<ClonedItinerary> {
  const { itinerary } = await http<ItineraryResponse>(`/api/itineraries/${input.itineraryId}/merge`, {
    method: 'POST',
    body: {
      selections: input.selections.map((s) => ({ ...s, source: sampleSource(s.postId, s.dayIds) })),
    },
  })
  return withCover(itinerary)
}

/** DELETE /api/itineraries/:id/days/:dayId */
export async function removeItineraryDay(
  id: ObjectId,
  dayId: ObjectId,
  _ownerId: ObjectId,
): Promise<ClonedItinerary> {
  const { itinerary } = await http<ItineraryResponse>(`/api/itineraries/${id}/days/${dayId}`, { method: 'DELETE' })
  return withCover(itinerary)
}
