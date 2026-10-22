import { Schema, model } from 'mongoose'

/**
 * A journey (trip post). Field names match `TripPost` in web/src/services/types.ts.
 *
 * Journeys by real accounts live here; the seed journeys the web app shows are
 * still mock JSON, and the web service layer merges the two. `days` and
 * `routeGeoJson` are stored as given: their shape is validated by the route's
 * zod schema, and the web app owns their nested ids.
 *
 * `status` is "draft" until the author publishes. `deletedAt` marks a journey
 * in "Recently Deleted"; it is removed for good after lib/retention.ts's window.
 */
const tripPostSchema = new Schema(
  {
    authorId: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    /** The author's own photos of the journey, up to 10; the first is `coverUrl`. */
    coverImages: { type: [String], default: [] },
    region: { type: String, required: true },
    season: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: [Schema.Types.Mixed], default: [] },
    tags: { type: [String], default: [] },
    budgetLevel: { type: String, required: true },
    totalEstCost: { type: Number, default: 0 },
    routeGeoJson: { type: Schema.Types.Mixed, default: () => ({ type: 'FeatureCollection', features: [] }) },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    cloneCount: { type: Number, default: 0 },
    /** Friends the author invited along (lib/companions.ts). */
    companions: {
      type: [
        {
          _id: false,
          userId: { type: String, required: true },
          status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
)

tripPostSchema.index({ status: 1, deletedAt: 1, createdAt: -1 })
tripPostSchema.index({ authorId: 1, deletedAt: 1, updatedAt: -1 })

export const TripPost = model('TripPost', tripPostSchema)
export type TripPostDocument = InstanceType<typeof TripPost>
