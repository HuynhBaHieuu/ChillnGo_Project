import { Schema, model } from 'mongoose'

/**
 * A travel destination (Đà Lạt, Hội An…): the area AI clone draws extra places
 * from, and the season facts it may mention. Entered by admins or seeded
 * (scripts/seed-places.ts); a journey belongs to the destination most of its
 * stops fall inside (`center` + `radiusKm`).
 *
 * Season fields stay empty when nobody has entered them: nothing about
 * weather or festivals is ever guessed.
 */
const destinationSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    region: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    /** Places farther than this from the centre are not suggested. */
    radiusKm: { type: Number, required: true },
    /** Months (1–12) of the rainy season. */
    rainyMonths: { type: [Number], default: [] },
    /** Months (1–12) of the high season. */
    peakMonths: { type: [Number], default: [] },
    festivals: { type: [{ _id: false, name: String, month: Number }], default: [] },
  },
  { timestamps: true, versionKey: false },
)

export const Destination = model('Destination', destinationSchema)
export type DestinationDocument = InstanceType<typeof Destination>
