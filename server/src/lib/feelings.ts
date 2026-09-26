/**
 * Feelings and activities a check-in can carry.
 *
 * Stored as these fixed keys, never free text, so they can be counted later:
 * "most people feel relaxed here" recommendations, or a per-user travel recap.
 * Labels and emoji live in web/src/lib/feelings.ts; keep the keys in step.
 */
export const FEELINGS = [
  // feelings
  'happy',
  'relaxed',
  'excited',
  'tired_but_happy',
  'peaceful',
  'grateful',
  'amazed',
  'nostalgic',
  'adventurous',
  'romantic',
  // activities
  'eating',
  'drinking_coffee',
  'watching_sunset',
  'swimming',
  'trekking',
  'camping',
  'road_trip',
  'exploring',
  'taking_photos',
  'shopping',
] as const

export type Feeling = (typeof FEELINGS)[number]
