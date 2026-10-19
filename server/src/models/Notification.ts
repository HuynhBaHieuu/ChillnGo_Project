import { Schema, model } from 'mongoose'

/**
 * Something that happened that a user should hear about. Only the kinds the
 * server produces live here (new follower, someone went live, a like, comment
 * or clone of a journey); the rest of the app's notifications are still mock
 * data in the web app.
 */
export const NOTIFICATION_TYPES = ['follow', 'live', 'like', 'comment', 'clone'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

const notificationSchema = new Schema(
  {
    /** Who receives it. */
    userId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    /** Who caused it. */
    actorId: { type: String, default: null },
    livestreamId: { type: String, default: null },
    /** The journey a like or comment is about. */
    postId: { type: String, default: null },
    /** The comment a 'comment' notification is about, so deleting it takes the notification back. */
    commentId: { type: String, default: null },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ postId: 1 }, { sparse: true })
// Old notifications clean themselves up after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const Notification = model('Notification', notificationSchema)

/** Sends the same notification to many users. Never throws: a failed notification must not fail the action. */
export async function notify(
  userIds: string[],
  body: { type: NotificationType; actorId: string; message: string; livestreamId?: string; postId?: string; commentId?: string },
): Promise<void> {
  if (userIds.length === 0) return
  await Notification.insertMany(
    userIds.map((userId) => ({ userId, ...body })),
    { ordered: false },
  ).catch((error: unknown) => console.error('notify failed:', error))
}
