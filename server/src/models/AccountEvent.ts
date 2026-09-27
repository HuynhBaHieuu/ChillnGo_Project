import { Schema, model } from 'mongoose'

export const ACCOUNT_EVENTS = [
  'account_created',
  'email_verified',
  'avatar_changed',
  'avatar_removed',
  'cover_changed',
  'cover_removed',
  'username_changed',
  'display_name_changed',
  'bio_changed',
  'location_changed',
] as const
export type AccountEventType = (typeof ACCOUNT_EVENTS)[number]

/**
 * A change to the user's own account, for "Account History". Written where
 * the change happens (auth.ts, users.ts); never back-filled, so the history
 * only holds events that really took place. `details` carries what changed
 * where that is safe to show the owner (old and new username, for example).
 */
const accountEventSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: ACCOUNT_EVENTS, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false },
)

accountEventSchema.index({ userId: 1, createdAt: -1 })

export const AccountEvent = model('AccountEvent', accountEventSchema)

/**
 * Records events for one user. Never throws: a history row that cannot be
 * written must not undo the change the user just made.
 */
export async function recordAccountEvents(
  userId: string,
  events: { type: AccountEventType; details?: Record<string, unknown> }[],
): Promise<void> {
  if (events.length === 0) return
  await AccountEvent.insertMany(events.map((e) => ({ userId, type: e.type, details: e.details ?? {} }))).catch(
    (error: unknown) => {
      console.error(`Could not record account events for ${userId}:`, error)
    },
  )
}
