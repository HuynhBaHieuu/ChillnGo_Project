/**
 * Every TanStack Query key in one place.
 *
 * Keys are built as functions so invalidation after a mutation can target
 * exactly the right subtree — e.g. `qk.post.detail(id)` after a like, or
 * `qk.post.all` after creating a post.
 */

import type { DiscoverFilters } from '@/services/types'

export const qk = {
  post: {
    all: ['posts'] as const,
    feed: (viewerId: string | null) => ['posts', 'feed', viewerId] as const,
    detail: (id: string, viewerId: string | null) => ['posts', 'detail', id, viewerId] as const,
    byAuthor: (authorId: string, viewerId: string | null) =>
      ['posts', 'author', authorId, viewerId] as const,
    published: (viewerId: string | null) => ['posts', 'published', viewerId] as const,
    comments: (postId: string) => ['posts', 'comments', postId] as const,
  },
  discover: {
    all: ['discover'] as const,
    list: (filters: DiscoverFilters, viewerId: string | null) =>
      ['discover', 'list', filters, viewerId] as const,
    tags: ['discover', 'tags'] as const,
  },
  social: {
    user: (id: string) => ['social', 'user', id] as const,
    isFollowing: (id: string, viewerId: string | null) =>
      ['social', 'isFollowing', id, viewerId] as const,
    bookmarks: (userId: string, viewerId: string | null) =>
      ['social', 'bookmarks', userId, viewerId] as const,
    notifications: (viewerId: string) => ['social', 'notifications', viewerId] as const,
  },
  itinerary: {
    all: ['itineraries'] as const,
    mine: (ownerId: string) => ['itineraries', 'mine', ownerId] as const,
    detail: (id: string) => ['itineraries', 'detail', id] as const,
  },
  landing: {
    stats: ['landing', 'stats'] as const,
    destinations: ['landing', 'destinations'] as const,
    moments: (limit: number) => ['landing', 'moments', limit] as const,
  },
  admin: {
    queue: ['admin', 'queue'] as const,
    users: ['admin', 'users'] as const,
    stats: ['admin', 'stats'] as const,
  },
} as const
