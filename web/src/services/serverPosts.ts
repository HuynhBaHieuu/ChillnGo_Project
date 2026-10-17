/**
 * The bridge between journeys stored by the API (server/src/routes/posts.ts)
 * and the mock collections the rest of the service layer still reads.
 *
 * Journeys written by real accounts live in MongoDB. Seed journeys, likes,
 * comments, bookmarks and clones are still mock data in `db`. Rather than
 * teaching every reader about two sources, the API's journeys are copied into
 * `db.tripPosts` (and their authors into `db.users`) before a read, so feeds,
 * Discover, bookmarks and cloning work on both unchanged.
 *
 * Internal to services/: components never import this.
 */

import { clone, db } from './client'
import { http } from './http'
import type { TripPost, User } from './types'
import { themeFromText, travelCover } from '@/lib/photos'
import { useAuthStore } from '@/store/auth.store'

/** Journeys from the API carry where they are in "Recently Deleted". */
export type ServerTripPost = TripPost & { deletedAt: string | null; purgeAt: string | null }

/** Ids of the journeys in `db.tripPosts` that came from the API. */
const fromServer = new Set<string>()

/** API ids are MongoDB ObjectIds; mock ids look like `p_001`. */
export function isServerPostId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id)
}

/** Adds or refreshes authors, without overwriting a richer record already there. */
export function upsertAuthors(authors: User[]) {
  for (const author of authors) {
    const index = db.users.findIndex((u) => u._id === author._id)
    if (index === -1) db.users.push(clone(author))
    else db.users[index] = { ...clone(author), ...db.users[index], avatarUrl: author.avatarUrl || db.users[index].avatarUrl }
  }
}

/** Records that `viewerId` has (or has not) liked a journey, in the mock likes the rest of the service layer reads. */
export function setLiked(viewerId: string, postId: string, liked: boolean) {
  const index = db.likes.findIndex((l) => l.userId === viewerId && l.postId === postId)
  if (liked && index === -1) db.likes.push({ userId: viewerId, postId })
  if (!liked && index !== -1) db.likes.splice(index, 1)
}

/**
 * Puts one API journey into `db.tripPosts`. Like and comment counts come from
 * the API; bookmark and clone counts are still counted by the mocks, so an
 * existing copy keeps its own.
 */
export function upsertServerPost(post: ServerTripPost): TripPost {
  fromServer.add(post._id)
  const index = db.tripPosts.findIndex((p) => p._id === post._id)
  const stored: TripPost = clone(post)
  // No cover chosen: the automatic one the editor would have given it.
  if (!stored.coverUrl) stored.coverUrl = travelCover(stored.title.slice(0, 30) || 'chillngo', themeFromText(stored.title))
  if (index === -1) {
    db.tripPosts.unshift(stored)
    return stored
  }
  const local = db.tripPosts[index]
  db.tripPosts[index] = {
    ...stored,
    bookmarkCount: local.bookmarkCount,
    cloneCount: local.cloneCount,
  }
  return db.tripPosts[index]
}

/** Takes a journey out of `db.tripPosts` (deleted, or no longer visible). */
export function dropServerPost(id: string) {
  fromServer.delete(id)
  const index = db.tripPosts.findIndex((p) => p._id === id)
  if (index !== -1) db.tripPosts.splice(index, 1)
}

let inflight: Promise<void> | null = null
let syncedAt = 0
let syncedFor: string | null = null
/** Reads within this window reuse the last sync; writes update `db` directly. */
const FRESH_MS = 5_000

async function pull(viewerId: string | null) {
  const published = await http<{ items: ServerTripPost[]; authors: User[] }>('/api/posts', { auth: false })
  const [mine, liked] = viewerId
    ? await Promise.all([
        http<{ items: ServerTripPost[] }>('/api/posts/mine?status=all').then((r) => r.items),
        http<{ ids: string[] }>('/api/posts/liked-ids').then((r) => r.ids),
      ])
    : [[], null]

  upsertAuthors(published.authors)
  const seen = new Set<string>()
  for (const post of [...published.items, ...mine]) {
    upsertServerPost(post)
    seen.add(post._id)
  }
  // Deleted, unpublished or signed out since the last sync.
  for (const id of [...fromServer]) if (!seen.has(id)) dropServerPost(id)

  // Your likes on API journeys are the API's to say; likes on seed journeys stay as they are.
  if (viewerId && liked) {
    db.likes = db.likes.filter((l) => l.userId !== viewerId || !isServerPostId(l.postId))
    // `liked` is newest first; db.likes is oldest first.
    for (const postId of [...liked].reverse()) db.likes.push({ userId: viewerId, postId })
  }
}

/**
 * Brings `db.tripPosts` up to date with the API: every published journey, plus
 * the signed-in user's own drafts. An unreachable API leaves the mock data as
 * it is, so the rest of the site keeps working.
 */
export async function syncServerPosts(): Promise<void> {
  const viewerId = useAuthStore.getState().user?._id ?? null
  if (viewerId === syncedFor && Date.now() - syncedAt < FRESH_MS) return
  if (inflight) return inflight

  inflight = pull(viewerId)
    .then(() => {
      syncedAt = Date.now()
      syncedFor = viewerId
    })
    .catch((error: unknown) => {
      console.warn('Could not load journeys from the API:', error)
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
