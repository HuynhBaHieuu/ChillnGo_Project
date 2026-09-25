/**
 * Mock transport layer.
 *
 * Every service function in this folder goes through here instead of `fetch`.
 * The fixtures are loaded once into a mutable in-memory database so that writes
 * made during a session (likes, bookmarks, clones, new posts, reordered days)
 * survive navigation — they reset on a full page reload, which is what we want
 * for a demo.
 *
 * When `server/` exists, this file is the only thing that goes away: each
 * service function swaps its `db` access for a `http()` call and keeps the exact
 * same signature and return type, so no component changes.
 */

import bookmarksFixture from '@/mocks/bookmarks.json'
import clonedItinerariesFixture from '@/mocks/clonedItineraries.json'
import commentsFixture from '@/mocks/comments.json'
import followsFixture from '@/mocks/follows.json'
import notificationsFixture from '@/mocks/notifications.json'
import tripPostsFixture from '@/mocks/tripPosts.json'
import usersFixture from '@/mocks/users.json'

import type {
  Bookmark,
  ClonedItinerary,
  Comment,
  Follow,
  Notification,
  TripPost,
  User,
} from './types'

/** Artificial network latency, 300–400ms, so loading states are real. */
export function delay(): Promise<void> {
  const ms = 300 + Math.round(Math.random() * 100)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Hand back a detached copy so callers can never mutate the store by holding a
 * reference — the same guarantee a real HTTP response gives you.
 */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Monotonic id generator for records created during a session. */
let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_local_${Date.now().toString(36)}${idCounter}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Thrown for anything the API answers with a 4xx/5xx. `code` is set for
 * errors the UI reacts to specifically, e.g. EMAIL_NOT_VERIFIED.
 */
export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status = 404, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function assertFound<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new ApiError(message, 404)
  }
  return value
}

/**
 * Seed a collection from its JSON fixture.
 *
 * The double cast is unavoidable and deliberate: TypeScript widens JSON imports
 * (`"published"` becomes `string`, a `[number, number]` tuple becomes
 * `number[]`), so the inferred fixture type never structurally matches the
 * collection type even when the data is correct. This one function is where we
 * assert that the fixtures satisfy the schema — `src/mocks/*.json` is the thing
 * to fix if that assertion is ever wrong.
 */
function seed<T>(fixture: unknown): T[] {
  return clone(fixture) as T[]
}

/** The in-memory database, seeded from the JSON fixtures. */
export const db = {
  users: seed<User>(usersFixture),
  tripPosts: seed<TripPost>(tripPostsFixture),
  comments: seed<Comment>(commentsFixture),
  follows: seed<Follow>(followsFixture),
  bookmarks: seed<Bookmark>(bookmarksFixture),
  clonedItineraries: seed<ClonedItinerary>(clonedItinerariesFixture),
  notifications: seed<Notification>(notificationsFixture),

  /** Session-local like records — the fixtures only carry aggregate counts. */
  likes: [] as { userId: string; postId: string }[],
}

export type Db = typeof db
