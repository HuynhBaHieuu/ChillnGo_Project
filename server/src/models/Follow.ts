import { Schema, model } from 'mongoose'

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
