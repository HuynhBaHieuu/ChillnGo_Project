import { Schema, model } from 'mongoose'

import { env } from '../env.js'
import { HttpError } from '../lib/errors.js'

/**
 * How many AI requests (an AI clone, a chat message) each user made per day,
 * so one person cannot spend the whole model quota. Days are Vietnam days.
 */
const aiUsageSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** YYYY-MM-DD, Asia/Ho_Chi_Minh. */
    day: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true })
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 })

export const AiUsage = model('AiUsage', aiUsageSchema)

/** Today in Vietnam (UTC+7, no daylight saving). */
function today(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

export async function aiCallsLeft(userId: string): Promise<number> {
  const usage = await AiUsage.findOne({ userId, day: today() }).lean()
  return Math.max(0, env.aiDailyLimit - (usage?.count ?? 0))
}

/** Uses up one of today's AI requests, or answers 429 when none are left. */
export async function takeAiCall(userId: string): Promise<void> {
  try {
    // Only matches while under the limit; at the limit the upsert collides with
    // today's row on the unique index instead of creating a second one.
    await AiUsage.findOneAndUpdate(
      { userId, day: today(), count: { $lt: env.aiDailyLimit } },
      { $inc: { count: 1 } },
      { upsert: true },
    )
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    throw new HttpError(
      429,
      `Bạn đã dùng hết ${env.aiDailyLimit} lượt AI hôm nay. Hãy quay lại vào ngày mai nhé.`,
      'AI_DAILY_LIMIT',
    )
  }
}

/** Gives back a request the AI could not answer, so a failure costs nothing. */
export async function giveBackAiCall(userId: string): Promise<void> {
  await AiUsage.updateOne({ userId, day: today(), count: { $gt: 0 } }, { $inc: { count: -1 } })
}
