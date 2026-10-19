import { Schema, model } from 'mongoose'

/**
 * Place categories, as stored. Labels are what the web app shows; the AI sees
 * the labels too, never anything it could take for a fact about the place.
 */
export const PLACE_CATEGORIES = {
  food: 'Ăn uống',
  cafe: 'Cà phê',
  sightseeing: 'Tham quan',
  nature: 'Thiên nhiên',
  culture: 'Văn hoá – lịch sử',
  shopping: 'Mua sắm',
  activity: 'Trải nghiệm',
  nightlife: 'Về đêm',
  stay: 'Lưu trú',
} as const

export type PlaceCategory = keyof typeof PLACE_CATEGORIES

/**
 * A place the AI may put in an itinerary. It only ever refers to places by id;
 * everything shown about one (name, cost, hours…) comes from here.
 *
 * Every fact is nullable: unknown stays null and is shown as "chưa có dữ liệu",
 * never estimated. `avgCost` is per person, in VND. `openingHours` is the same
 * every day; `close` earlier than `open` runs past midnight.
 */
const placeSchema = new Schema(
  {
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    category: { type: String, enum: [...Object.keys(PLACE_CATEGORIES), null], default: null },
    avgCost: { type: Number, default: null },
    /** 1 (cheap) to 4 (expensive), when no average cost is known. */
    priceLevel: { type: Number, default: null },
    openingHours: { type: { _id: false, open: String, close: String }, default: null },
    isOutdoor: { type: Boolean, default: null },
    requiresBooking: { type: Boolean, default: null },
    /** 0–5. */
    rating: { type: Number, default: null },
    photoUrl: { type: String, default: null },
    /**
     * What kind of trip a visit makes it, for the preparation checklist
     * (ChecklistTemplate tags): beach, mountain, temple, water. Empty when unknown.
     */
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false },
)

export const Place = model('Place', placeSchema)
export type PlaceDocument = InstanceType<typeof Place>
