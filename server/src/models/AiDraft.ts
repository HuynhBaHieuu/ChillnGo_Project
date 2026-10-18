import { Schema, model } from 'mongoose'

/**
 * An AI-adapted itinerary under review, before it is saved as an Itinerary.
 * Shapes are the plain objects of ai/draft.ts (`DraftState`): the candidate
 * places and the source journey's stops are snapshots taken when the draft was
 * made, so it reads the same however the database changes meanwhile.
 *
 * `rev` goes up on every write; a write against an older `rev` is refused, so
 * two quick clicks cannot overwrite each other. Drafts delete themselves 24
 * hours after they were made.
 */
const aiDraftSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sourcePostIds: { type: [String], default: [] },
    destinationId: { type: String, default: null },
    formInput: { type: Schema.Types.Mixed, required: true },
    /** The model's first plan, as validated. Kept for reference; `changes` is what is shown. */
    plan: { type: Schema.Types.Mixed, default: null },
    candidates: { type: [Schema.Types.Mixed], default: [] },
    sourceStops: { type: [Schema.Types.Mixed], default: [] },
    changes: { type: [Schema.Types.Mixed], default: [] },
    nextChange: { type: Number, default: 1 },
    chatHistory: { type: [{ _id: false, role: String, content: String, at: Date }], default: [] },
    /** The destination's season facts for the trip's months (ai/feasibility.ts `SeasonFacts`), or null. */
    season: { type: Schema.Types.Mixed, default: null },
    /** The preparation checklist (ai/checklist.ts), once asked for. */
    checklist: { type: Schema.Types.Mixed, default: null },
    committedItineraryId: { type: String, default: null },
    rev: { type: Number, default: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 3600_000) },
  },
  { timestamps: true, versionKey: false, minimize: false },
)

aiDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const AiDraft = model('AiDraft', aiDraftSchema)
