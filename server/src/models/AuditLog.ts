import { Schema, model } from 'mongoose'

/**
 * One row per admin action: who did what to which account, and when.
 * Names are copied in, so a row still reads correctly after the account it
 * mentions is deleted. Only the superadmin can read this collection.
 */
const auditLogSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: 'user' },
    targetId: { type: String, default: '' },
    targetLabel: { type: String, default: '' },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

auditLogSchema.index({ createdAt: -1 })

export const AuditLog = model('AuditLog', auditLogSchema)
