import { Schema, model } from 'mongoose'

/** System settings: a single document with `_id: 'app'`. Superadmin only. */
const settingSchema = new Schema(
  {
    _id: { type: String, default: 'app' },
    /** When false, new accounts cannot be created (email or Google). */
    registrationOpen: { type: Boolean, default: true },
    /** Shown as a banner across the site when not empty. */
    announcement: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
)

export const Setting = model('Setting', settingSchema)

export interface AppSettings {
  registrationOpen: boolean
  announcement: string
}

export async function getSettings(): Promise<AppSettings> {
  const doc = await Setting.findById('app').lean()
  return {
    registrationOpen: doc?.registrationOpen ?? true,
    announcement: doc?.announcement ?? '',
  }
}
