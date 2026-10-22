/**
 * Other people's profiles and following them.
 *
 *   GET  /api/users/me/following   ids of everyone you follow
 *   GET  /api/users/me/friends     your friends (you follow each other), by name
 *   GET  /api/users/:id            a member's public profile (+ followedByMe)
 *   POST /api/users/:id/follow     follow / unfollow (toggles)
 *
 * Mounted before usersRouter (your own profile, which requires sign-in for
 * every route): anything not matched here falls through to it.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'

import { HttpError } from '../lib/errors.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Follow, followingIdsOf, follows, friendIdsOf } from '../models/Follow.js'
import { notify } from '../models/Notification.js'
import { User, adjustCount } from '../models/User.js'
import type { UserDocument } from '../models/User.js'

export const profilesRouter = Router()

/** What anyone may see about a member: no email, no admin details. */
function publicProfile(user: UserDocument) {
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: '',
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    location: user.location,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    postCount: user.postCount,
    role: 'user' as const,
    createdAt: user.createdAt.toISOString(),
  }
}

/** A member who can be looked at and followed: an active, non-staff account. */
async function loadMember(id: string): Promise<UserDocument> {
  const user = isValidObjectId(id) ? await User.findById(id) : null
  if (!user || user.role !== 'user' || user.status !== 'active') {
    throw new HttpError(404, 'Không tìm thấy người dùng.', 'NOT_FOUND')
  }
  return user
}

profilesRouter.get('/me/following', requireAuth, loadCurrentUser, async (_req, res) => {
  res.json({ ids: await followingIdsOf(res.locals.userId as string) })
})

profilesRouter.get('/me/friends', requireAuth, loadCurrentUser, async (_req, res) => {
  const ids = await friendIdsOf(res.locals.userId as string)
  const users = await User.find({ _id: { $in: ids }, role: 'user', status: 'active' }).sort({ displayName: 1 }).limit(500)
  res.json({ items: users.map(publicProfile) })
})

profilesRouter.get('/:id', optionalAuth, async (req, res, next) => {
  // Not an id ("me", …): usersRouter's business.
  const id = String(req.params.id)
  if (!isValidObjectId(id)) {
    next()
    return
  }
  const user = await loadMember(id)
  res.json({ user: publicProfile(user), followedByMe: await follows(res.locals.userId as string | undefined, user._id) })
})

const followLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_req, res) => String(res.locals.userId),
  message: { message: 'Bạn thao tác theo dõi quá nhanh. Đợi một chút rồi thử lại.' },
})

profilesRouter.post('/:id/follow', requireAuth, loadCurrentUser, followLimiter, async (req, res) => {
  const me = currentUser(res)
  const target = await loadMember(String(req.params.id))
  if (target._id === me._id) throw new HttpError(400, 'Bạn không thể tự theo dõi chính mình.', 'SELF_FOLLOW')

  const removed = await Follow.findOneAndDelete({ followerId: me._id, followingId: target._id })
  let following: boolean
  if (removed) {
    following = false
  } else {
    try {
      await Follow.create({ followerId: me._id, followingId: target._id })
      following = true
    } catch (error) {
      // A double tap raced us: the follow already exists.
      if ((error as { code?: number }).code !== 11000) throw error
      res.json({ following: true, followerCount: target.followerCount })
      return
    }
  }

  // Counters never go below zero, whatever happened before they were kept.
  const step = following ? 1 : -1
  await Promise.all([adjustCount(target._id, 'followerCount', step), adjustCount(me._id, 'followingCount', step)])
  const updated = await User.findById(target._id).select('followerCount').lean()
  if (following) {
    await notify([target._id], { type: 'follow', actorId: me._id, message: 'đã bắt đầu theo dõi bạn' })
  }
  res.json({ following, followerCount: updated?.followerCount ?? 0 })
})
