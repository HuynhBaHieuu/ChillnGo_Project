/**
 * A small draft for the AI tests: five candidates, a source journey of three
 * stops over two days, and a valid two-day plan against it.
 */

import { changesFromPlan } from './draft.js'
import type { Candidate, DraftState, SourceStop } from './draft.js'
import type { FormInput, Plan } from './schemas.js'

export const form: FormInput = {
  startDate: '2026-11-20',
  days: 2,
  groupSize: 2,
  withChildren: false,
  withElderly: false,
  budget: null,
  departure: 'Quận 1',
  interests: [],
  pace: 'moderate',
}

export function candidate(key: string, fields: Partial<Candidate>): Candidate {
  return {
    key,
    placeId: `place-${key}`,
    name: key,
    address: '',
    lat: 11.94,
    lng: 108.44,
    category: 'food',
    avgCost: null,
    authorCost: null,
    priceLevel: null,
    openingHours: null,
    isOutdoor: null,
    requiresBooking: null,
    rating: null,
    photoUrl: null,
    tags: [],
    valueScore: 50,
    inSource: false,
    ...fields,
  }
}

export const candidates: Candidate[] = [
  candidate('P1', { name: 'Hồ Xuân Hương', avgCost: 0, authorCost: 0, inSource: true, category: 'nature' }),
  candidate('P2', { name: 'Chợ đêm Đà Lạt', avgCost: 100000, authorCost: 200000, inSource: true }),
  // A stop of the source journey that is no Place: only its author's cost is known.
  candidate('P3', { name: 'Homestay của nhóm', placeId: null, authorCost: 800000, inSource: true, category: null }),
  candidate('P4', { name: 'Cà phê 1960', avgCost: 40000, category: 'cafe', lat: 11.95, lng: 108.45 }),
  // Nothing known about its cost.
  candidate('P5', { name: 'Thác Datanla', category: 'activity' }),
]

const stop = (key: string, dayIndex: number, candidateKey: string, note: string): SourceStop => ({
  key,
  postId: 'post-1',
  dayIndex,
  candidateKey,
  location: { _id: `old-${key}`, name: candidateKey, note, estCost: 1, lat: 11.9, lng: 108.4, photoUrl: null },
})

export const sourceStops: SourceStop[] = [
  stop('S1', 1, 'P1', 'Đi bộ quanh hồ.'),
  stop('S2', 1, 'P2', 'Ăn tối.'),
  stop('S3', 2, 'P3', 'Thuê nguyên căn.'),
]

export const validPlan: Plan = {
  days: [
    {
      dayIndex: 1,
      stops: [
        { placeId: 'P1', startTime: '08:00', durationMin: 90, action: 'keep', sourceStopId: 'S1', reason: 'Được yêu thích, giữ nguyên.' },
        { placeId: 'P4', startTime: '10:00', durationMin: 60, action: 'add', reason: 'Gần hồ, hợp sở thích cà phê.' },
        { placeId: 'P2', startTime: '18:00', durationMin: 120, action: 'keep', sourceStopId: 'S2', reason: 'Ăn tối như hành trình gốc.' },
      ],
    },
    {
      dayIndex: 2,
      stops: [
        { placeId: 'P5', startTime: '09:00', durationMin: 120, action: 'replace', sourceStopId: 'S3', reason: 'Thay bằng điểm trải nghiệm.' },
      ],
    },
  ],
  removed: [],
}

/** The base a plan is checked against. */
export const base = { formInput: form, candidates, sourceStops }

/** A fresh draft made from `validPlan`. */
export function freshDraft(): DraftState {
  return structuredClone({ ...base, ...changesFromPlan(validPlan, base) })
}
