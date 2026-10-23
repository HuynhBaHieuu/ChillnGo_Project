/**
 * Users, follows, bookmarks and notifications.
 *
 * Real accounts (MongoDB ids) go to the API: profiles, follows and
 * notifications live in server/. The demo accounts from the fixtures
 * ("u_001"…) stay on the mock database, so the seeded content keeps working
 * until it moves to the server too.
 */

import { travelAvatar, travelBanner } from '@/lib/photos'

import { assertFound, clone, db, delay, nextId, nowIso } from './client'
import { syncServerPosts } from './serverPosts'
import { http } from './http'
import { decorate } from './post.service'
import type {
  NotificationWithActor,
  ObjectId,
  TripPostWithAuthor,
  User,
} from './types'
import { t } from '@/i18n'

/** An account stored on the server, as opposed to a fixture account. */
export function isServerId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}

/** New accounts have no photos yet: the same travel defaults the signed-in user gets (auth.service). */
function withAvatar(user: User): User {
  return {
    ...user,
    avatarUrl: user.avatarUrl || travelAvatar(user.username),
    coverUrl: user.coverUrl || travelBanner(user.username),
  }
}

async function fetchProfile(id: ObjectId): Promise<{ user: User; followedByMe: boolean }> {
  const result = await http<{ user: User; followedByMe: boolean }>(`/api/users/${id}`)
  return { ...result, user: withAvatar(result.user) }
}

/** GET /api/users/:id */
export async function getUserById(id: ObjectId): Promise<User> {
  if (isServerId(id)) return (await fetchProfile(id)).user
  await delay()
  return clone(
    assertFound(
      db.users.find((u) => u._id === id),
      t('Không tìm thấy người dùng {id}', { id }),
    ),
  )
}

/** Ids of the accounts `viewerId` follows: server follows plus any demo accounts followed this session. */
export async function getFollowingIds(viewerId: ObjectId): Promise<ObjectId[]> {
  const local = db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId)
  if (!isServerId(viewerId)) return local
  const { ids } = await http<{ ids: ObjectId[] }>('/api/users/me/following')
  return [...ids, ...local]
}

/** GET /api/users/me/friends — the people you follow who follow you back. Demo accounts have none. */
export async function getFriends(viewerId: ObjectId): Promise<User[]> {
  if (!isServerId(viewerId)) return []
  const { items } = await http<{ items: User[] }>('/api/users/me/friends')
  return items.map(withAvatar)
}

/** Is `viewerId` following `userId`? */
export async function isFollowing(
  userId: ObjectId,
  viewerId: ObjectId | null,
): Promise<boolean> {
  if (!viewerId) return false
  if (isServerId(userId)) return (await fetchProfile(userId)).followedByMe
  await delay()
  return db.follows.some(
    (f) => f.followerId === viewerId && f.followingId === userId,
  )
}

/**
 * POST /api/users/:id/follow — toggles.
 *
 * The UI updates optimistically and reconciles against what this returns.
 */
export async function toggleFollow(
  userId: ObjectId,
  viewerId: ObjectId,
): Promise<{ following: boolean; followerCount: number }> {
  if (isServerId(userId)) {
    return http<{ following: boolean; followerCount: number }>(`/api/users/${userId}/follow`, { method: 'POST' })
  }

  await delay()

  const target = assertFound(
    db.users.find((u) => u._id === userId),
    t('Không tìm thấy người dùng {id}', { id: userId }),
  )
  const viewer = db.users.find((u) => u._id === viewerId)

  const index = db.follows.findIndex(
    (f) => f.followerId === viewerId && f.followingId === userId,
  )

  if (index === -1) {
    db.follows.push({
      _id: nextId('f'),
      followerId: viewerId,
      followingId: userId,
      createdAt: nowIso(),
    })
    target.followerCount += 1
    if (viewer) viewer.followingCount += 1
  } else {
    db.follows.splice(index, 1)
    target.followerCount = Math.max(0, target.followerCount - 1)
    if (viewer) viewer.followingCount = Math.max(0, viewer.followingCount - 1)
  }

  return { following: index === -1, followerCount: target.followerCount }
}

/** GET /api/users/:id/bookmarks — the posts a user has saved. */
export async function getBookmarkedPosts(
  userId: ObjectId,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await Promise.all([delay(), syncServerPosts()])

  return db.bookmarks
    .filter((b) => b.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((b) => db.tripPosts.find((p) => p._id === b.postId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => decorate(p, viewerId))
}

/** GET /api/notifications, together with the demo notifications for fixture accounts. */
export async function getNotifications(
  viewerId: ObjectId,
): Promise<NotificationWithActor[]> {
  const local: NotificationWithActor[] = db.notifications
    .filter((n) => n.userId === viewerId)
    .map((n) => ({
      ...clone(n),
      actor: n.actorId
        ? clone(db.users.find((u) => u._id === n.actorId) ?? null)
        : null,
    }))

  let remote: NotificationWithActor[] = []
  if (isServerId(viewerId)) {
    const { items } = await http<{ items: NotificationWithActor[] }>('/api/notifications')
    remote = items.map((n) => ({ ...n, actor: n.actor ? withAvatar(n.actor) : null }))
  } else {
    await delay()
  }

  return [...remote, ...local].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

/** POST /api/notifications/read */
export async function markAllNotificationsRead(
  viewerId: ObjectId,
): Promise<{ unreadCount: number }> {
  for (const n of db.notifications) {
    if (n.userId === viewerId) n.read = true
  }
  if (isServerId(viewerId)) await http('/api/notifications/read', { method: 'POST' })
  return { unreadCount: 0 }
}
