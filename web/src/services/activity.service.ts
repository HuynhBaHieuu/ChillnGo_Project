/**
 * "Your Activity" (server/src/routes/activity.ts): the signed-in user's own
 * search history, account history and livestream comments. The server scopes
 * every call to the caller; there is no parameter naming another user.
 *
 * Likes, trip comments and saved journeys come from post.service and
 * social.service; drafts and "Recently Deleted" journeys from post.service;
 * check-ins from checkin.service.
 */

import { db, clone } from './client'
import { http } from './http'
import { decorate } from './post.service'
import { syncServerPosts } from './serverPosts'
import type { Comment, ObjectId, TripPostWithAuthor } from './types'

/* --------------------------------------------------------- search history */

export type SearchType = 'user' | 'place' | 'post' | 'journey'

export interface SearchEntry {
  _id: string
  type: SearchType
  query: string
  searchedAt: string
}

export async function listSearchHistory(): Promise<SearchEntry[]> {
  const { items } = await http<{ items: SearchEntry[] }>('/api/activity/search-history')
  return items
}

/**
 * Records one search. Fire-and-forget from the search boxes: a history row
 * that cannot be written must never get in the way of the search itself.
 */
export function recordSearch(type: SearchType, query: string): void {
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  void http('/api/activity/search-history', { method: 'POST', body: { type, query: trimmed.slice(0, 120) } }).catch(
    () => undefined,
  )
}

export function removeSearch(id: string): Promise<{ ok: true }> {
  return http(`/api/activity/search-history/${id}`, { method: 'DELETE' })
}

export function clearSearchHistory(): Promise<{ ok: true }> {
  return http('/api/activity/search-history', { method: 'DELETE' })
}

/* -------------------------------------------------------- account history */

export type AccountEventType =
  | 'account_created'
  | 'email_verified'
  | 'avatar_changed'
  | 'avatar_removed'
  | 'cover_changed'
  | 'cover_removed'
  | 'username_changed'
  | 'display_name_changed'
  | 'bio_changed'
  | 'location_changed'

export interface AccountEvent {
  _id: string
  type: AccountEventType
  details: { from?: string; to?: string; via?: string }
  createdAt: string
}

export async function listAccountHistory(): Promise<AccountEvent[]> {
  const { items } = await http<{ items: AccountEvent[] }>('/api/activity/account-history')
  return items
}

/* ------------------------------------------------------------ interactions */

export interface LiveCommentActivity {
  _id: string
  text: string
  createdAt: string
  livestream: {
    _id: string
    title: string
    status: 'live' | 'ended'
    host: { _id: string; displayName: string; username: string; avatarUrl: string } | null
  } | null
}

/** Comments you wrote in livestreams (stored by the API). */
export async function listLiveComments(): Promise<LiveCommentActivity[]> {
  const { items } = await http<{ items: LiveCommentActivity[] }>('/api/activity/live-comments')
  return items
}

/** Journeys you have liked, most recent first. Likes are still mock data. */
export async function listLikedJourneys(viewerId: ObjectId): Promise<TripPostWithAuthor[]> {
  await syncServerPosts()
  return [...db.likes]
    .reverse()
    .filter((l) => l.userId === viewerId)
    .map((l) => db.tripPosts.find((p) => p._id === l.postId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p?.status === 'published')
    .map((p) => decorate(p, viewerId))
}

export interface JourneyCommentActivity extends Comment {
  post: { _id: string; title: string; coverUrl: string } | null
}

/**
 * Comments you wrote on journeys, newest first: those on API journeys come
 * from the API, those on seed journeys are still mock data.
 */
export async function listJourneyComments(viewerId: ObjectId): Promise<JourneyCommentActivity[]> {
  const [, remote] = await Promise.all([
    syncServerPosts(),
    http<{ items: JourneyCommentActivity[] }>('/api/activity/journey-comments').then((r) => r.items),
  ])
  const local = db.comments
    .filter((c) => c.authorId === viewerId)
    .map((c) => {
      const post = db.tripPosts.find((p) => p._id === c.postId)
      return { ...clone(c), post: post ? { _id: post._id, title: post.title, coverUrl: post.coverUrl } : null }
    })
  return [...remote, ...local].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
