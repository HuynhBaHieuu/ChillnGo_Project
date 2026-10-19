import { Schema, model } from 'mongoose'

/**
 * A journey someone cloned to plan their own trip ("Đã clone về"). Private to
 * its owner. Field names match `ClonedItinerary` in web/src/services/types.ts;
 * `days` has the journey's shape (TripDay), stored as given.
 *
 * `sourcePostIds` is every journey it took days from, in order: the first is
 * the one it was cloned from, all of them are credited. `cloneType` says how it
 * was made: copied as-is, adapted by AI, or merged from several by AI;
 * `aiMeta` keeps the form the AI was given.
 */
const itinerarySchema = new Schema(
  {
    ownerId: { type: String, required: true },
    sourcePostIds: { type: [String], default: [] },
    cloneType: { type: String, enum: ['manual', 'ai', 'merge'], default: 'manual' },
    aiMeta: { type: Schema.Types.Mixed, default: null },
    title: { type: String, default: '' },
    note: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    startDate: { type: String, required: true },
    days: { type: [Schema.Types.Mixed], default: [] },
    totalEstCost: { type: Number, default: 0 },
    status: { type: String, enum: ['planning', 'confirmed', 'completed'], default: 'planning' },
    /** The preparation checklist made for an AI draft, kept when it was saved. */
    checklist: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
)

itinerarySchema.index({ ownerId: 1, updatedAt: -1 })

export const Itinerary = model('Itinerary', itinerarySchema)
export type ItineraryDocument = InstanceType<typeof Itinerary>

/** What the web app's `ClonedItinerary` type expects. */
export function itineraryView(itinerary: ItineraryDocument) {
  return {
    _id: String(itinerary._id),
    ownerId: itinerary.ownerId,
    sourcePostIds: itinerary.sourcePostIds,
    cloneType: itinerary.cloneType,
    aiMeta: itinerary.aiMeta,
    title: itinerary.title,
    note: itinerary.note,
    coverUrl: itinerary.coverUrl,
    startDate: itinerary.startDate,
    days: itinerary.days,
    totalEstCost: itinerary.totalEstCost,
    status: itinerary.status,
    checklist: itinerary.checklist,
    createdAt: itinerary.createdAt.toISOString(),
    updatedAt: itinerary.updatedAt.toISOString(),
  }
}
