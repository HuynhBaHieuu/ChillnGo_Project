import { Schema, model } from 'mongoose'

import { FEELINGS } from '../lib/feelings.js'

/**
 * A check-in: up to four photos, a caption, a feeling or activity, and a place
 * (picked from search or taken from the device's position). At least one of
 * photos, caption or feeling is present.
 */
const checkInSchema = new Schema(
  {
    authorId: { type: String, required: true, index: true },
    caption: { type: String, default: '' },
    /** A key from lib/feelings.ts, e.g. "relaxed" or "watching_sunset". */
    feeling: { type: String, enum: [...FEELINGS, null], default: null },
    photos: {
      type: [
        {
          _id: false,
          publicId: { type: String, required: true },
          url: { type: String, required: true },
          width: { type: Number, default: 0 },
          height: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    location: {
      type: {
        _id: false,
        name: { type: String, required: true },
        address: { type: String, default: '' },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
)

checkInSchema.index({ createdAt: -1 })
checkInSchema.index({ authorId: 1, createdAt: -1 })
// For later "how do people feel here" and per-user recaps.
checkInSchema.index({ feeling: 1 })

export const CheckIn = model('CheckIn', checkInSchema)
