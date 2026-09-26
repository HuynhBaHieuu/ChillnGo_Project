/**
 * Other people's profiles and following them.
 *
 *   GET  /api/users/me/following   ids of everyone you follow
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
import { Follow, followingIdsOf, follows } from '../models/Follow.js'
import { notify } from '../models/Notification.js'
import { User } from '../models/User.js'
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

profilesRouter.get('/me/following', requireAuth, async (_req, res) => {
  res.json({ ids: await followingIdsOf(res.locals.userId as string) })
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

  const step = following ? 1 : -1
  const [updated] = await Promise.all([
    User.findByIdAndUpdate(target._id, { $inc: { followerCount: step } }, { new: true }),
    User.updateOne({ _id: me._id }, { $inc: { followingCount: step } }),
  ])
  if (following) {
    await notify([target._id], { type: 'follow', actorId: me._id, message: 'đã bắt đầu theo dõi bạn' })
  }
  res.json({ following, followerCount: Math.max(0, updated?.followerCount ?? 0) })
})
