/** Users, follows, bookmarks and notifications. */

import { assertFound, clone, db, delay, nextId, nowIso } from './client'
import { decorate } from './post.service'
import type {
  NotificationWithActor,
  ObjectId,
  TripPostWithAuthor,
  User,
} from './types'

/** GET /api/users/:id */
export async function getUserById(id: ObjectId): Promise<User> {
  await delay()
  return clone(
    assertFound(
      db.users.find((u) => u._id === id),
      `Không tìm thấy người dùng ${id}`,
    ),
  )
}

/** GET /api/users/:id/follow — is `viewerId` following `userId`? */
/** Ids of the accounts `viewerId` follows. Mock data, like the rest of this file. */
export async function getFollowingIds(viewerId: ObjectId): Promise<ObjectId[]> {
  return db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId)
}

export async function isFollowing(
  userId: ObjectId,
  viewerId: ObjectId | null,
): Promise<boolean> {
  await delay()
  if (!viewerId) return false
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
  await delay()

  const target = assertFound(
    db.users.find((u) => u._id === userId),
    `Không tìm thấy người dùng ${userId}`,
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
  await delay()

  return db.bookmarks
    .filter((b) => b.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((b) => db.tripPosts.find((p) => p._id === b.postId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => decorate(p, viewerId))
}

/** GET /api/notifications */
export async function getNotifications(
  viewerId: ObjectId,
): Promise<NotificationWithActor[]> {
  await delay()

  return db.notifications
    .filter((n) => n.userId === viewerId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((n) => ({
      ...clone(n),
      actor: n.actorId
        ? clone(db.users.find((u) => u._id === n.actorId) ?? null)
        : null,
    }))
}

/** POST /api/notifications/read */
export async function markAllNotificationsRead(
  viewerId: ObjectId,
): Promise<{ unreadCount: number }> {
  await delay()
  for (const n of db.notifications) {
    if (n.userId === viewerId) n.read = true
  }
  return { unreadCount: 0 }
}
