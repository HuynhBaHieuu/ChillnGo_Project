import { Schema, model } from 'mongoose'

import { adjustCount } from './User.js'

/** `followerId` follows `followingId`. The pair is unique. */
const followSchema = new Schema(
  {
    followerId: { type: String, required: true },
    followingId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true })

export const Follow = model('Follow', followSchema)

/** Does `followerId` follow `followingId`? */
export async function follows(followerId: string | undefined, followingId: string): Promise<boolean> {
  if (!followerId || followerId === followingId) return false
  return Boolean(await Follow.exists({ followerId, followingId }))
}

/** Everyone `userId` follows. */
export async function followingIdsOf(userId: string): Promise<string[]> {
  const rows = await Follow.find({ followerId: userId }).select('followingId').lean()
  return rows.map((r) => r.followingId)
}

/** Everyone who follows `userId`. */
export async function followerIdsOf(userId: string): Promise<string[]> {
  const rows = await Follow.find({ followingId: userId }).select('followerId').lean()
  return rows.map((r) => r.followerId)
}

/**
 * Takes a locked account out of everyone else's follower / following counts
 * (`counted` false), or puts it back when it is unlocked (`counted` true).
 *
 * The follows themselves stay, so unlocking restores them as they were. Nothing
 * changes them in between: a locked account cannot sign in, and nobody can
 * follow or unfollow it (routes/profiles.ts only accepts active members).
 */
export async function countFollowsOf(userId: string, counted: boolean): Promise<void> {
  const step = counted ? 1 : -1
  const [following, followers] = await Promise.all([followingIdsOf(userId), followerIdsOf(userId)])
  await Promise.all([adjustCount(following, 'followerCount', step), adjustCount(followers, 'followingCount', step)])
}
