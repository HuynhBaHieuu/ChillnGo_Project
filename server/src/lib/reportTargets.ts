/**
 * The content a report is about: finding it, describing it for the moderation
 * queue, and hiding, removing or showing it again. The rules on who may do
 * what are in lib/reports.ts; the routes check them before calling here.
 */

import { isValidObjectId } from 'mongoose'

import { HttpError } from './errors.js'
import { excerpt } from './reports.js'
import type { ReportTargetType } from './reports.js'
import { Business, BusinessPost } from '../models/Business.js'
import { CheckIn } from '../models/CheckIn.js'
import { PostComment } from '../models/PostInteraction.js'
import { TripPost } from '../models/TripPost.js'
import { User } from '../models/User.js'
import { adjustPostCount, recountComments, removeCommentThread } from '../routes/posts.js'

export interface TargetSnapshot {
  title: string
  text: string
  imageUrl: string
  postId: string | null
}

export interface ReportTarget {
  type: ReportTargetType
  id: string
  ownerId: string
  /** Whether people can see it now: published / not deleted / its journey visible. Reports need this. */
  visible: boolean
  hidden: boolean
  action: string | null
  /** Who hid it: a moderator's id, or "system" for the automatic hide. */
  hiddenBy: string | null
  snapshot: TargetSnapshot
}

const notFound = () => new HttpError(404, 'Không tìm thấy nội dung này.', 'NOT_FOUND')

/** The content as it is now, or `null` when it no longer exists. */
export async function findTarget(type: ReportTargetType, id: string): Promise<ReportTarget | null> {
  if (!isValidObjectId(id)) return null

  if (type === 'post') {
    const post = await TripPost.findById(id).lean()
    if (!post) return null
    return {
      type,
      id,
      ownerId: post.authorId,
      visible: post.status === 'published' && !post.deletedAt,
      hidden: Boolean(post.moderation?.hidden),
      action: post.moderation?.action ?? null,
      hiddenBy: post.moderation?.by ?? null,
      snapshot: { title: excerpt(post.title, 150), text: excerpt(post.summary), imageUrl: post.coverUrl, postId: id },
    }
  }

  if (type === 'comment') {
    const comment = await PostComment.findById(id).lean()
    if (!comment) return null
    const post = isValidObjectId(comment.postId) ? await TripPost.findById(comment.postId).select('title status deletedAt').lean() : null
    return {
      type,
      id,
      ownerId: comment.authorId,
      visible: Boolean(post && post.status === 'published' && !post.deletedAt),
      hidden: Boolean(comment.moderation?.hidden),
      action: comment.moderation?.action ?? null,
      hiddenBy: comment.moderation?.by ?? null,
      snapshot: { title: post ? excerpt(post.title, 150) : '', text: excerpt(comment.content, 1000), imageUrl: '', postId: comment.postId },
    }
  }

  if (type === 'checkin') {
    const checkin = await CheckIn.findById(id).lean()
    if (!checkin) return null
    return {
      type,
      id,
      ownerId: checkin.authorId,
      visible: !checkin.deletedAt,
      hidden: Boolean(checkin.moderation?.hidden),
      action: checkin.moderation?.action ?? null,
      hiddenBy: checkin.moderation?.by ?? null,
      snapshot: {
        title: checkin.location?.name ?? '',
        text: excerpt(checkin.caption),
        imageUrl: checkin.photos[0]?.url ?? '',
        postId: null,
      },
    }
  }

  if (type === 'business') {
    const business = await Business.findById(id).lean()
    if (!business) return null
    return {
      type,
      id,
      ownerId: business.ownerId,
      visible: business.status === 'approved',
      hidden: Boolean(business.moderation?.hidden),
      action: business.moderation?.action ?? null,
      hiddenBy: business.moderation?.by ?? null,
      snapshot: { title: excerpt(business.name, 150), text: excerpt(business.description), imageUrl: business.photos[0] ?? '', postId: null },
    }
  }

  if (type === 'businessPost') {
    const post = await BusinessPost.findById(id).lean()
    if (!post) return null
    const business = isValidObjectId(post.businessId) ? await Business.findById(post.businessId).select('status').lean() : null
    return {
      type,
      id,
      ownerId: post.authorId,
      visible: !post.deletedAt && business?.status === 'approved',
      hidden: Boolean(post.moderation?.hidden),
      action: post.moderation?.action ?? null,
      hiddenBy: post.moderation?.by ?? null,
      snapshot: { title: excerpt(post.title, 150), text: excerpt(post.content), imageUrl: post.photos[0] ?? '', postId: null },
    }
  }

  const user = await User.findById(id).select('username displayName bio avatarUrl status').lean()
  if (!user) return null
  return {
    type,
    id,
    ownerId: String(user._id),
    visible: true,
    hidden: user.status === 'locked',
    action: user.status === 'locked' ? 'lock' : null,
    hiddenBy: null,
    snapshot: { title: `${user.displayName} (@${user.username})`, text: excerpt(user.bio ?? ''), imageUrl: user.avatarUrl ?? '', postId: null },
  }
}

function moderationSet(hidden: boolean, action: 'hide' | 'remove' | null, by: string | null, reason: string) {
  return { moderation: { hidden, action, reason, by, at: hidden ? new Date() : null } }
}

/** Hides content until a moderator unhides it. `by`: a moderator's id, or "system". */
export async function hideTarget(type: ReportTargetType, id: string, by: string, reason: string): Promise<void> {
  const $set = moderationSet(true, 'hide', by, reason)
  if (type === 'post') {
    await TripPost.updateOne({ _id: id }, { $set })
  } else if (type === 'checkin') {
    await CheckIn.updateOne({ _id: id }, { $set })
  } else if (type === 'comment') {
    const comment = await PostComment.findByIdAndUpdate(id, { $set }).lean()
    if (comment) await recountComments(comment.postId)
  } else if (type === 'business') {
    await Business.updateOne({ _id: id }, { $set })
  } else if (type === 'businessPost') {
    await BusinessPost.updateOne({ _id: id }, { $set })
  } else {
    throw new HttpError(400, 'Không thể ẩn một tài khoản. Hãy dùng Khoá tài khoản.', 'INVALID_ACTION')
  }
}

/**
 * Removes content. A journey or check-in goes to its author's "Recently
 * Deleted", marked so the author cannot restore it, and is purged on the usual
 * schedule; a comment (with its replies) is deleted at once.
 */
export async function removeTarget(type: ReportTargetType, id: string, by: string, reason: string): Promise<void> {
  const moderation = moderationSet(true, 'remove', by, reason)
  if (type === 'post') {
    const post = await TripPost.findById(id)
    if (!post) throw notFound()
    const wasCounted = post.status === 'published' && !post.deletedAt
    post.set({ ...moderation, deletedAt: post.deletedAt ?? new Date() })
    await post.save()
    if (wasCounted) await adjustPostCount(post.authorId, -1)
  } else if (type === 'checkin') {
    const checkin = await CheckIn.findById(id)
    if (!checkin) throw notFound()
    checkin.set({ ...moderation, deletedAt: checkin.deletedAt ?? new Date() })
    await checkin.save()
  } else if (type === 'comment') {
    const comment = await PostComment.findById(id).lean()
    if (!comment) throw notFound()
    await removeCommentThread(comment.postId, String(comment._id), comment.parentId)
  } else if (type === 'business') {
    // A business page is not deleted: it stays hidden until a moderator shows it again.
    await Business.updateOne({ _id: id }, { $set: moderation })
  } else if (type === 'businessPost') {
    const post = await BusinessPost.findById(id)
    if (!post) throw notFound()
    post.set({ ...moderation, deletedAt: post.deletedAt ?? new Date() })
    await post.save()
  } else {
    throw new HttpError(400, 'Không thể gỡ một tài khoản. Hãy dùng Khoá tài khoản.', 'INVALID_ACTION')
  }
}

/** Shows hidden content again; removed content also comes back out of "Recently Deleted". */
export async function unhideTarget(type: ReportTargetType, id: string): Promise<void> {
  const $set = moderationSet(false, null, null, '')
  if (type === 'post') {
    const post = await TripPost.findById(id)
    if (!post) throw notFound()
    const removed = post.moderation?.action === 'remove'
    post.set({ ...$set, ...(removed ? { deletedAt: null } : {}) })
    await post.save()
    if (removed && post.status === 'published') await adjustPostCount(post.authorId, 1)
  } else if (type === 'checkin') {
    const checkin = await CheckIn.findById(id)
    if (!checkin) throw notFound()
    const removed = checkin.moderation?.action === 'remove'
    checkin.set({ ...$set, ...(removed ? { deletedAt: null } : {}) })
    await checkin.save()
  } else if (type === 'comment') {
    const comment = await PostComment.findByIdAndUpdate(id, { $set }).lean()
    if (!comment) throw new HttpError(404, 'Bình luận này đã bị xoá hẳn, không khôi phục được.', 'NOT_FOUND')
    await recountComments(comment.postId)
  } else if (type === 'business') {
    await Business.updateOne({ _id: id }, { $set })
  } else if (type === 'businessPost') {
    const post = await BusinessPost.findById(id)
    if (!post) throw notFound()
    const removed = post.moderation?.action === 'remove'
    post.set({ ...$set, ...(removed ? { deletedAt: null } : {}) })
    await post.save()
  } else {
    throw new HttpError(400, 'Tài khoản không bị ẩn. Hãy mở khoá ở mục Người dùng.', 'INVALID_ACTION')
  }
}
