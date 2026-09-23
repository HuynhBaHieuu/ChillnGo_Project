/**
 * Trip post reads and writes.
 *
 * Swapping in the real Express API means replacing each function body with a
 * `fetch` — the signatures and return types here are the contract.
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
import type {
  Comment,
  CommentThread,
  ObjectId,
  TripPost,
  TripPostPayload,
  TripPostWithAuthor,
  User,
} from './types'

/* ------------------------------------------------------------- internals */

function authorOf(post: TripPost): User {
  return assertFound(
    db.users.find((u) => u._id === post.authorId),
    `Không tìm thấy tác giả của bài viết ${post._id}`,
  )
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
 */
export async function getFeed(viewerId: ObjectId | null): Promise<TripPostWithAuthor[]> {
  await delay()

  if (!viewerId) {
    return db.tripPosts
      .filter((p) => p.status === 'published')
      .sort(byNewest)
      .map((p) => decorate(p, null))
  }

  const followingIds = new Set(
    db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId),
  )
  followingIds.add(viewerId)

  return db.tripPosts
    .filter((p) => p.status === 'published' && followingIds.has(p.authorId))
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/** GET /api/posts/:id */
export async function getPostById(
  id: ObjectId,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor> {
  await delay()
  const post = assertFound(
    db.tripPosts.find((p) => p._id === id),
    `Không tìm thấy bài viết ${id}`,
  )
  return decorate(post, viewerId)
}

/** GET /api/users/:id/posts — published posts only, unless you are the author. */
export async function getPostsByAuthor(
  authorId: ObjectId,
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await delay()
  return db.tripPosts
    .filter((p) => p.authorId === authorId)
    .filter((p) => p.status === 'published' || p.authorId === viewerId)
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/** GET /api/posts?ids=… — used by the merge-from-another-post picker. */
export async function getPublishedPosts(
  viewerId: ObjectId | null,
): Promise<TripPostWithAuthor[]> {
  await delay()
  return db.tripPosts
    .filter((p) => p.status === 'published')
    .sort(byNewest)
    .map((p) => decorate(p, viewerId))
}

/* ---------------------------------------------------------------- writes */

/**
 * POST /api/posts.
 *
 * The payload is logged in full because this is the shape the Express handler
 * will receive — keeping it visible in the console is how we verify the form
 * builder and the schema agree before the API exists.
 */
export async function createPost(payload: TripPostPayload): Promise<TripPost> {
  await delay()

  // eslint-disable-next-line no-console -- intentional: verifies the wire shape
  console.info('[mock] POST /api/posts', JSON.parse(JSON.stringify(payload)))

  const post: TripPost = {
    _id: nextId('p'),
    ...clone(payload),
    likeCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
    cloneCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  db.tripPosts.unshift(post)

  const author = db.users.find((u) => u._id === post.authorId)
  if (author && post.status === 'published') author.postCount += 1

  return clone(post)
}

/** PATCH /api/posts/:id */
export async function updatePost(
  id: ObjectId,
  payload: TripPostPayload,
): Promise<TripPost> {
  await delay()

  // eslint-disable-next-line no-console -- intentional: verifies the wire shape
  console.info(`[mock] PATCH /api/posts/${id}`, JSON.parse(JSON.stringify(payload)))

  const index = db.tripPosts.findIndex((p) => p._id === id)
  if (index === -1) throw new ApiError(`Không tìm thấy bài viết ${id}`)

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
  await delay()
  const post = assertFound(
    db.tripPosts.find((p) => p._id === postId),
    `Không tìm thấy bài viết ${postId}`,
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
    `Không tìm thấy bài viết ${postId}`,
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
  await delay()

  const forPost = db.comments.filter((c) => c.postId === postId)
  const authorFor = (c: Comment): User =>
    assertFound(
      db.users.find((u) => u._id === c.authorId),
      `Không tìm thấy tác giả bình luận ${c._id}`,
    )

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
