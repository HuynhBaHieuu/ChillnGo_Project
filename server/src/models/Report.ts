import { Schema, model } from 'mongoose'

import { REPORT_ACTIONS, REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES } from '../lib/reports.js'

/**
 * One person's report about a journey, comment, check-in or account. Each
 * person reports a given thing once (unique index). The moderation queue groups
 * reports by what they are about; resolving decides for all pending ones at once.
 *
 * `snapshot` is what the content looked like when it was reported, so a
 * moderator can still judge it after the author edits or deletes it.
 */
const reportSchema = new Schema(
  {
    reporterId: { type: String, required: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    targetId: { type: String, required: true },
    targetOwnerId: { type: String, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    note: { type: String, default: '' },
    snapshot: {
      type: {
        _id: false,
        title: { type: String, default: '' },
        text: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        /** The journey a comment is on, for the link to it. */
        postId: { type: String, default: null },
      },
      default: () => ({}),
    },
    status: { type: String, enum: REPORT_STATUSES, default: 'pending' },
    action: { type: String, enum: REPORT_ACTIONS, default: 'none' },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
)

reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true })
reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ targetType: 1, targetId: 1 })
// The hourly limit on reports per person.
reportSchema.index({ reporterId: 1, createdAt: -1 })

export const Report = model('Report', reportSchema)
export type ReportDocument = InstanceType<typeof Report>
