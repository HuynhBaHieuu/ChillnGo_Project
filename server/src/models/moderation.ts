import { Schema } from 'mongoose'

/**
 * Set by moderators (or automatically, once enough people report something)
 * on a journey, check-in or comment. Hidden content disappears from every
 * public read; its author still sees it, marked "Đã bị ẩn do vi phạm".
 *
 * `action` says how it was hidden: "hide" can be undone by unhiding, "remove"
 * also put it in the author's "Recently Deleted", from which the author cannot
 * restore it. `by` is the moderator's id, or "system" for the automatic hide.
 *
 * Kept apart from PostComment's `hidden` (the journey's author hiding a
 * comment on their own journey) so an author cannot undo a moderator.
 */
export const moderationSchema = new Schema(
  {
    hidden: { type: Boolean, default: false },
    action: { type: String, enum: ['hide', 'remove', null], default: null },
    reason: { type: String, default: '' },
    by: { type: String, default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
)

export const moderationField = { type: moderationSchema, default: () => ({}) }

/** A query condition that leaves out content hidden by moderation (old documents have no field: shown). */
export const NOT_MODERATED = { 'moderation.hidden': { $ne: true } }

export interface ModerationState {
  hidden?: boolean | null
  action?: string | null
  reason?: string | null
}

export function isModerated(moderation: ModerationState | null | undefined): boolean {
  return Boolean(moderation?.hidden)
}

/** What an author is told about their own hidden content; `null` when it is not hidden. */
export function moderationView(moderation: ModerationState | null | undefined) {
  if (!moderation?.hidden) return null
  return { hidden: true, action: moderation.action ?? 'hide', reason: moderation.reason ?? '' }
}
