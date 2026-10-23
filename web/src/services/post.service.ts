/**
 * Trip post reads and writes.
 *
 * Journeys by real accounts are stored by the API (server/src/routes/posts.ts):
 * creating, editing, publishing and deleting go there. Seed journeys, likes,
 * comments and bookmarks are still mock data in `db`; serverPosts.ts copies the
 * API's journeys into `db` before each read so both kinds behave the same.
 */

import {
  ApiError,
  assertFound,
  clone,
  db,
  delay,
  nextId,
  nowIso,
} from './client'
import { http } from './http'
import {
  dropServerPost,
  isServerPostId,
  setLiked,
  syncServerPosts,
  upsertAuthors,
  upsertServerPost,
} from './serverPosts'
import type { ServerTripPost } from './serverPosts'
import type {
  Comment,
  CommentThread,
  ObjectId,
  TripPost,
  TripPostPayload,
  TripPostWithAuthor,
  User,
} from './types'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import type { SignedUpload } from '@/lib/cloudinaryUpload'
import { prepareImageForUpload } from '@/lib/images'
import { t } from '@/i18n'

export type { ServerTripPost } from './serverPosts'

/* ------------------------------------------------------------- internals */

/**
 * Stands in for an author who is not in `db` (a fixture id with no account behind it),
 * so one missing person does not break the feed or a comment list.
 */
function deletedUser(id: ObjectId): User {
  return {
    _id: id,
    username: 'deleted',
    displayName: t('Tài khoản đã xoá'),
    email: '',
    avatarUrl: '',
    coverUrl: '',
    bio: '',
    location: '',
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    role: 'user',
    createdAt: new Date(0).toISOString(),
  }
}

function userOrPlaceholder(id: ObjectId): User {
  return db.users.find((u) => u._id === id) ?? deletedUser(id)
}

function authorOf(post: TripPost): User {
  return userOrPlaceholder(post.authorId)
}

/**
 * Join a raw post with its author and the viewer's own like/bookmark state.
 * The real API will do this server-side; components only ever see the joined
 * shape.
 */
export function decorate(post: TripPost, viewerId: ObjectId | null): TripPostWithAuthor {
  return {
    ...clone(post),
    author: clone(authorOf(post)),
    companions: post.companions?.map((c) => ({ ...c, user: clone(userOrPlaceholder(c.userId)) })),
    likedByMe: viewerId
      ? db.likes.some((l) => l.userId === viewerId && l.postId === post._id)
      : false,
    bookmarkedByMe: viewerId
      ? db.bookmarks.some((b) => b.userId === viewerId && b.postId === post._id)
      : false,
  }
}

function byNewest(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

/* ----------------------------------------------------------------- reads */

/**
 * GET /api/feed — published posts by the people `viewerId` follows, newest
 * first. The viewer's own posts are included so a new post shows up right away.
 * `followingIds` (socialService.getFollowingIds) adds the follows stored by the
 * API, which `db.follows` does not know about.
 */
export async function getFeed(
  viewerId: ObjectId | null,
  followingIds: ObjectId[] = [],
): Promise<TripPostWithAuthor[]> {
  await Promise.all([delay(), syncServerPosts()])

  if (!viewerId) {
    return db.tripPosts
      .filter((p) => p.status === 'published')
      .sort(byNewest)
      .map((p) => decorate(p, null))
  }

  const authors = new Set([
    ...db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId),
    ...followingIds,
    viewerId,
  ])

  return db.tripPosts
    .filter((p) => p.status === 'published' && authors.has(p.authorId))
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/** GET /api/posts/:id */
export async function getPostById(
  id: ObjectId,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor> {
  if (isServerPostId(id)) {
    const { post, authors, likedByMe } = await http<{ post: ServerTripPost; authors: User[]; likedByMe: boolean }>(
      `/api/posts/${id}`,
    )
    upsertAuthors(authors)
    if (viewerId) setLiked(viewerId, post._id, likedByMe)
    return decorate(upsertServerPost(post), viewerId)
  }

  await delay()
  const post = assertFound(
    db.tripPosts.find((p) => p._id === id),
    t('Không tìm thấy bài viết {id}', { id }),
  )
  return decorate(post, viewerId)
}

/**
 * GET /api/users/:id/posts — published posts only. The author's drafts are in
 * Your Activity → Journeys (listDraftJourneys), not on the public profile.
 */
export async function getPostsByAuthor(
  authorId: ObjectId,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await Promise.all([delay(), syncServerPosts()])
  return db.tripPosts
    // Journeys they came along on count as theirs too.
    .filter(
      (p) =>
        p.authorId === authorId ||
        p.companions?.some((c) => c.userId === authorId && c.status === 'accepted'),
    )
    .filter((p) => p.status === 'published')
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/** GET /api/posts?ids=… — used by the merge-from-another-post picker. */
export async function getPublishedPosts(
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await Promise.all([delay(), syncServerPosts()])
  return db.tripPosts
    .filter((p) => p.status === 'published')
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/* ---------------------------------------------------------------- writes */

/** POST /api/posts — saved to the database, as a draft or published. */
export async function createPost(payload: TripPostPayload): Promise<TripPost> {
  const { post } = await http<{ post: ServerTripPost }>('/api/posts', { method: 'POST', body: payload })
  const stored = upsertServerPost(post)

  const author = db.users.find((u) => u._id === post.authorId)
  if (author && post.status === 'published') author.postCount += 1

  return clone(stored)
}

/**
 * Uploads a journey image (the cover, or a stop's photo) and returns its
 * address. The file is shrunk in the browser to `maxSide`, then sent straight
 * to Cloudinary with a signature from the API.
 */
export async function uploadJourneyImage(
  original: File,
  onProgress?: (percent: number) => void,
  maxSide = 1920,
): Promise<string> {
  const file = await prepareImageForUpload(original, maxSide)
  const signature = await http<SignedUpload & { publicId: string }>('/api/posts/cover-signature', { method: 'POST' })
  const uploaded = await uploadToCloudinary(signature, file, onProgress)
  if (!uploaded.secure_url) throw new ApiError(t('Không nhận được địa chỉ ảnh sau khi tải lên.'), 0)
  return uploaded.secure_url
}

/** PATCH /api/posts/:id */
export async function updatePost(
  id: ObjectId,
  payload: TripPostPayload,
): Promise<TripPost> {
  if (isServerPostId(id)) {
    const { post } = await http<{ post: ServerTripPost }>(`/api/posts/${id}`, { method: 'PATCH', body: payload })
    return clone(upsertServerPost(post))
  }

  // Seed journeys are mock data: edits to them stay in this session.
  await delay()

  const index = db.tripPosts.findIndex((p) => p._id === id)
  if (index === -1) throw new ApiError(t('Không tìm thấy bài viết {id}', { id }))

  const updated: TripPost = {
    ...db.tripPosts[index],
    ...clone(payload),
    updatedAt: nowIso(),
  }
  db.tripPosts[index] = updated

  return clone(updated)
}

/** POST /api/posts/:id/like — toggles, returns the new count and state. */
export async function toggleLike(
  postId: ObjectId,
  viewerId: ObjectId,
): Promise<{ likeCount: number; likedByMe: boolean }> {
  if (isServerPostId(postId)) {
    const result = await http<{ likeCount: number; likedByMe: boolean }>(`/api/posts/${postId}/like`, { method: 'POST' })
    setLiked(viewerId, postId, result.likedByMe)
    const stored = db.tripPosts.find((p) => p._id === postId)
    if (stored) stored.likeCount = result.likeCount
    return result
  }

  await delay()
  const post = assertFound(
    db.tripPosts.find((p) => p._id === postId),
    t('Không tìm thấy bài viết {id}', { id: postId }),
  )

  const index = db.likes.findIndex((l) => l.userId === viewerId && l.postId === postId)
  if (index === -1) {
    db.likes.push({ userId: viewerId, postId })
    post.likeCount += 1
  } else {
    db.likes.splice(index, 1)
    post.likeCount = Math.max(0, post.likeCount - 1)
  }

  return { likeCount: post.likeCount, likedByMe: index === -1 }
}

/** POST /api/posts/:id/bookmark — toggles, returns the new count and state. */
export async function toggleBookmark(
  postId: ObjectId,
  viewerId: ObjectId,
): Promise<{ bookmarkCount: number; bookmarkedByMe: boolean }> {
  await delay()
  const post = assertFound(
    db.tripPosts.find((p) => p._id === postId),
    t('Không tìm thấy bài viết {id}', { id: postId }),
  )

  const index = db.bookmarks.findIndex(
    (b) => b.userId === viewerId && b.postId === postId,
  )
  if (index === -1) {
    db.bookmarks.push({
      _id: nextId('b'),
      userId: viewerId,
      postId,
      createdAt: nowIso(),
    })
    post.bookmarkCount += 1
  } else {
    db.bookmarks.splice(index, 1)
    post.bookmarkCount = Math.max(0, post.bookmarkCount - 1)
  }

  return { bookmarkCount: post.bookmarkCount, bookmarkedByMe: index === -1 }
}

/* -------------------------------------------------------------- comments */

/**
 * GET /api/posts/:id/comments — returned as threads.
 *
 * Only one level of nesting is built here: a reply to a reply is attached to
 * the same root, which is how the UI renders it anyway.
 */
export async function getComments(postId: ObjectId): Promise<CommentThread[]> {
  let forPost: Comment[]
  if (isServerPostId(postId)) {
    const { items, authors } = await http<{ items: Comment[]; authors: User[] }>(`/api/posts/${postId}/comments`)
    upsertAuthors(authors)
    forPost = items
  } else {
    await delay()
    forPost = db.comments.filter((c) => c.postId === postId)
  }
  const authorFor = (c: Comment): User => userOrPlaceholder(c.authorId)

  const roots = forPost
    .filter((c) => c.parentId === null)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  return roots.map((root) => ({
    ...clone(root),
    author: clone(authorFor(root)),
    replies: forPost
      .filter((c) => c.parentId === root._id)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((reply) => ({
        ...clone(reply),
        author: clone(authorFor(reply)),
        replies: [],
      })),
  }))
}

/** POST /api/posts/:id/comments */
export async function addComment(input: {
  postId: ObjectId
  authorId: ObjectId
  parentId: ObjectId | null
  content: string
}): Promise<Comment> {
  if (isServerPostId(input.postId)) {
    const { comment, commentCount } = await http<{ comment: Comment; commentCount: number }>(
      `/api/posts/${input.postId}/comments`,
      { method: 'POST', body: { content: input.content, parentId: input.parentId } },
    )
    const stored = db.tripPosts.find((p) => p._id === input.postId)
    if (stored) stored.commentCount = commentCount
    return comment
  }

  await delay()

  const comment: Comment = {
    _id: nextId('c'),
    postId: input.postId,
    authorId: input.authorId,
    parentId: input.parentId,
    content: input.content.trim(),
    likeCount: 0,
    createdAt: nowIso(),
  }

  db.comments.push(comment)

  const post = db.tripPosts.find((p) => p._id === input.postId)
  if (post) post.commentCount += 1

  return clone(comment)
}

/** DELETE /api/posts/:id/comments/:commentId — a root comment takes its replies with it. */
export async function deleteComment(postId: ObjectId, commentId: ObjectId): Promise<void> {
  if (isServerPostId(postId)) {
    const { commentCount } = await http<{ commentCount: number }>(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    })
    const stored = db.tripPosts.find((p) => p._id === postId)
    if (stored) stored.commentCount = commentCount
    return
  }

  await delay()
  const doomed = new Set(
    db.comments.filter((c) => c.postId === postId && (c._id === commentId || c.parentId === commentId)).map((c) => c._id),
  )
  db.comments = db.comments.filter((c) => !doomed.has(c._id))
  const post = db.tripPosts.find((p) => p._id === postId)
  if (post) post.commentCount = Math.max(0, post.commentCount - doomed.size)
}

/** POST /api/posts/:id/comments/:commentId/hide — the journey's author hides or shows someone's comment. */
export async function hideComment(postId: ObjectId, commentId: ObjectId, hidden: boolean): Promise<void> {
  if (!isServerPostId(postId)) throw new ApiError(t('Bình luận này không thể ẩn.'), 400)
  const { commentCount } = await http<{ commentCount: number }>(`/api/posts/${postId}/comments/${commentId}/hide`, {
    method: 'POST',
    body: { hidden },
  })
  const stored = db.tripPosts.find((p) => p._id === postId)
  if (stored) stored.commentCount = commentCount
}

/* ------------------------------------------------------ journeys (drafts) */

/** GET /api/posts/mine — every journey you wrote (published and drafts), last edited first. */
export async function listMyJourneys(): Promise<ServerTripPost[]> {
  const { items } = await http<{ items: ServerTripPost[] }>('/api/posts/mine?status=all')
  for (const post of items) upsertServerPost(post)
  return items
}

/** GET /api/posts/mine?status=draft — your unpublished journeys, last edited first. */
export async function listDraftJourneys(): Promise<ServerTripPost[]> {
  const { items } = await http<{ items: ServerTripPost[] }>('/api/posts/mine?status=draft')
  for (const post of items) upsertServerPost(post)
  return items
}

/** GET /api/posts/mine?status=published — your published journeys. */
export async function listMyPublishedJourneys(): Promise<ServerTripPost[]> {
  const { items } = await http<{ items: ServerTripPost[] }>('/api/posts/mine?status=published')
  for (const post of items) upsertServerPost(post)
  return items
}

/** POST /api/posts/:id/publish */
export async function publishJourney(id: ObjectId): Promise<ServerTripPost> {
  const { post } = await http<{ post: ServerTripPost }>(`/api/posts/${id}/publish`, { method: 'POST' })
  upsertServerPost(post)
  const author = db.users.find((u) => u._id === post.authorId)
  if (author) author.postCount += 1
  return post
}

/** POST /api/posts/:id/duplicate — a new draft copy. */
export async function duplicateJourney(id: ObjectId): Promise<ServerTripPost> {
  const { post } = await http<{ post: ServerTripPost }>(`/api/posts/${id}/duplicate`, { method: 'POST' })
  upsertServerPost(post)
  return post
}

/** DELETE /api/posts/:id — to "Recently Deleted", restorable for 30 days. */
export async function deleteJourney(id: ObjectId): Promise<void> {
  const { post } = await http<{ post: ServerTripPost }>(`/api/posts/${id}`, { method: 'DELETE' })
  dropServerPost(id)
  const author = db.users.find((u) => u._id === post.authorId)
  if (author && post.status === 'published') author.postCount = Math.max(0, author.postCount - 1)
}

/** GET /api/posts/deleted */
export async function listDeletedJourneys(): Promise<ServerTripPost[]> {
  const { items } = await http<{ items: ServerTripPost[] }>('/api/posts/deleted')
  return items
}

/** POST /api/posts/:id/restore */
export async function restoreJourney(id: ObjectId): Promise<ServerTripPost> {
  const { post } = await http<{ post: ServerTripPost }>(`/api/posts/${id}/restore`, { method: 'POST' })
  upsertServerPost(post)
  const author = db.users.find((u) => u._id === post.authorId)
  if (author && post.status === 'published') author.postCount += 1
  return post
}

/** DELETE /api/posts/:id/permanent — gone for good. */
export async function deleteJourneyPermanently(id: ObjectId): Promise<void> {
  await http(`/api/posts/${id}/permanent`, { method: 'DELETE' })
  dropServerPost(id)
}

/* ------------------------------------------------------------ companions */

/** POST /api/posts/:id/companions — invite friends along on your journey. */
export async function inviteCompanions(postId: ObjectId, userIds: ObjectId[]): Promise<void> {
  const { post, authors } = await http<{ post: ServerTripPost; authors: User[] }>(`/api/posts/${postId}/companions`, {
    method: 'POST',
    body: { userIds },
  })
  upsertAuthors(authors)
  upsertServerPost(post)
}

/** POST /api/posts/:id/companions/respond — accept or decline your invite. */
export async function respondToInvite(postId: ObjectId, accept: boolean): Promise<void> {
  await http(`/api/posts/${postId}/companions/respond`, { method: 'POST', body: { accept } })
}

/** DELETE /api/posts/:id/companions/:userId — the author takes someone off, or you leave. */
export async function removeCompanion(postId: ObjectId, userId: ObjectId): Promise<void> {
  await http(`/api/posts/${postId}/companions/${userId}`, { method: 'DELETE' })
}
