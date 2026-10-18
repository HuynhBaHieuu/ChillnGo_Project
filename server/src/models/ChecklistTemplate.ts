import { Schema, model } from 'mongoose'

/**
 * One thing to prepare for a trip, shown when the trip has any of its `tags`:
 * `all` (every trip), a place category (food, nature…), a Place tag (beach,
 * mountain, temple, water), `outdoor`, `rainy` and `peak` (the destination's
 * season data), `kids` and `elderly` (the group). Entered by admins or seeded;
 * the AI only orders and groups these, it never adds one.
 */
const checklistTemplateSchema = new Schema(
  {
    text: { type: String, required: true },
    /** Heading it is listed under, e.g. "Giấy tờ", "Quần áo". */
    group: { type: String, required: true },
    tags: { type: [String], default: [] },
    /** Position within its group when nothing else orders it. */
    order: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

export const ChecklistTemplate = model('ChecklistTemplate', checklistTemplateSchema)
