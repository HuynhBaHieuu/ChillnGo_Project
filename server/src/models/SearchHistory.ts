import { Schema, model } from 'mongoose'

export const SEARCH_TYPES = ['user', 'place', 'post', 'journey'] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

/** How many searches each account keeps; the oldest drop off. */
export const SEARCH_HISTORY_LIMIT = 50

/**
 * One search the user made, for "Search History". Searching the same thing
 * again moves it to the top (upsert on user + type + query) instead of
 * adding a duplicate row.
 */
const searchHistorySchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: SEARCH_TYPES, required: true },
    query: { type: String, required: true },
    searchedAt: { type: Date, required: true },
  },
  { versionKey: false },
)

searchHistorySchema.index({ userId: 1, type: 1, query: 1 }, { unique: true })
searchHistorySchema.index({ userId: 1, searchedAt: -1 })

export const SearchHistory = model('SearchHistory', searchHistorySchema)
