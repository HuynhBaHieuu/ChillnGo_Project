/**
 * The candidate set of one AI request, from the database only: the source
 * journeys' own stops, then the places of their destination, those that fit
 * the form first. The model may use these and nothing else.
 *
 * A stop linked to a Place (`placeId`, as the seed journeys are) becomes that
 * Place; any other stop is a candidate of its own, known only by what its
 * author wrote.
 */

import { isValidObjectId } from 'mongoose'

import { Destination } from '../models/Destination.js'
import type { DestinationDocument } from '../models/Destination.js'
import { Place } from '../models/Place.js'
import { TripPost } from '../models/TripPost.js'
import type { TripPostDocument } from '../models/TripPost.js'
import { AI_CONFIG } from './config.js'
import { distanceKm, fitsInterests, rawValue, scaleScores } from './draft.js'
import type { Candidate, PlaceStats, SourceStop } from './draft.js'
import type { FormInput } from './schemas.js'

interface StopShape {
  name?: string
  address?: string
  estCost?: number
  photoUrl?: string | null
  lat?: number
  lng?: number
  placeId?: string
}

/** A stop with a real position: not missing, not the editor's "not placed yet" spot. */
function pinned(stop: StopShape): stop is StopShape & { lat: number; lng: number } {
  return typeof stop.lat === 'number' && typeof stop.lng === 'number' && !(stop.lng === 106 && stop.lat === 16)
}

/** Every stop of a journey, in order, with its 1-based day. */
function stopsOf(post: TripPostDocument): { stop: StopShape; dayIndex: number }[] {
  return (post.days as { locations?: StopShape[] }[]).flatMap((day, i) =>
    (day.locations ?? []).map((stop) => ({ stop, dayIndex: i + 1 })),
  )
}

/**
 * The destination journeys belong to: where their linked places are, else the
 * one whose area holds at least half of their stops. Null when none does.
 */
export async function destinationOf(posts: TripPostDocument[]): Promise<DestinationDocument | null> {
  const stops = posts.flatMap(stopsOf).map((s) => s.stop)

  const linked = stops.map((s) => s.placeId).filter((id): id is string => Boolean(id && isValidObjectId(id)))
  if (linked.length) {
    const places = await Place.find({ _id: { $in: linked } }).select('destinationId').lean()
    const counts = new Map<string, number>()
    for (const p of places) counts.set(String(p.destinationId), (counts.get(String(p.destinationId)) ?? 0) + 1)
    const [best] = [...counts].sort((a, b) => b[1] - a[1])
    const destination = best ? await Destination.findById(best[0]) : null
    if (destination) return destination
  }

  const located = stops.filter(pinned)
  if (located.length === 0) return null
  let best: DestinationDocument | null = null
  let inside = 0
  for (const destination of await Destination.find()) {
    const n = located.filter((s) => distanceKm(destination, s) <= destination.radiusKm).length
    if (n > inside) {
      best = destination
      inside = n
    }
  }
  return best && inside * 2 >= located.length ? best : null
}

/** Likes, clones and uses summed over the published journeys that visit each place. */
async function placeStats(placeIds: string[]): Promise<Map<string, PlaceStats>> {
  if (placeIds.length === 0) return new Map()
  const rows = await TripPost.aggregate<{ _id: string } & PlaceStats>([
    { $match: { status: 'published', deletedAt: null, 'days.locations.placeId': { $in: placeIds } } },
    { $unwind: '$days' },
    { $unwind: '$days.locations' },
    { $match: { 'days.locations.placeId': { $in: placeIds } } },
    // A journey that visits a place twice counts once.
    {
      $group: {
        _id: { place: '$days.locations.placeId', post: '$_id' },
        likes: { $first: '$likeCount' },
        clones: { $first: '$cloneCount' },
      },
    },
    { $group: { _id: '$_id.place', likes: { $sum: '$likes' }, clones: { $sum: '$clones' }, uses: { $sum: 1 } } },
  ])
  return new Map(rows.map((r) => [r._id, { likes: r.likes, clones: r.clones, uses: r.uses }]))
}

type PlaceRecord = Awaited<ReturnType<typeof loadPlaces>>[number]

function loadPlaces(filter: Record<string, unknown>) {
  return Place.find(filter).lean()
}

type Entry = { candidate: Omit<Candidate, 'key' | 'valueScore'>; raw: number }

function fromPlace(place: PlaceRecord, stats: Map<string, PlaceStats>, authorCost: number | null): Entry {
  const id = String(place._id)
  const hours = place.openingHours
  return {
    candidate: {
      placeId: id,
      name: place.name,
      address: place.address ?? '',
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      category: place.category ?? null,
      avgCost: place.avgCost ?? null,
      authorCost,
      priceLevel: place.priceLevel ?? null,
      openingHours: hours?.open && hours.close ? { open: hours.open, close: hours.close } : null,
      isOutdoor: place.isOutdoor ?? null,
      requiresBooking: place.requiresBooking ?? null,
      rating: place.rating ?? null,
      photoUrl: place.photoUrl ?? null,
      tags: place.tags ?? [],
      inSource: authorCost !== null,
    },
    raw: rawValue(stats.get(id) ?? { likes: 0, clones: 0, uses: 0 }, place.rating ?? null),
  }
}

/** A stop with no Place: only what its author wrote, and its journey's popularity. */
function fromStop(stop: StopShape, post: TripPostDocument): Entry {
  return {
    candidate: {
      placeId: null,
      name: stop.name?.trim() || 'Điểm dừng chưa đặt tên',
      address: stop.address ?? '',
      lat: pinned(stop) ? stop.lat : null,
      lng: pinned(stop) ? stop.lng : null,
      category: null,
      avgCost: null,
      authorCost: typeof stop.estCost === 'number' ? stop.estCost : null,
      priceLevel: null,
      openingHours: null,
      isOutdoor: null,
      requiresBooking: null,
      rating: null,
      photoUrl: stop.photoUrl ?? null,
      tags: [],
      inSource: true,
    },
    raw: rawValue({ likes: post.likeCount, clones: post.cloneCount, uses: 1 }, null),
  }
}

/** Several journeys (an AI merge) give their stops in turn, numbered S1, S2… across all of them. */
export async function buildCandidates(
  posts: TripPostDocument[],
  form: FormInput,
  destination: DestinationDocument | null,
): Promise<{ candidates: Candidate[]; sourceStops: SourceStop[] }> {
  const stops = posts.flatMap((post) => stopsOf(post).map((s) => ({ ...s, post })))
  const linkedIds = [...new Set(stops.map((s) => s.stop.placeId).filter((id): id is string => Boolean(id && isValidObjectId(id))))]
  const [linked, local] = await Promise.all([
    linkedIds.length ? loadPlaces({ _id: { $in: linkedIds } }) : [],
    destination ? loadPlaces({ destinationId: destination._id }) : [],
  ])
  const places = new Map([...local, ...linked].map((p) => [String(p._id), p]))
  const stats = await placeStats([...places.keys()])

  // The source journeys' stops first, in order; a place visited twice is one candidate.
  const entries: Entry[] = []
  const entryOfPlace = new Map<string, number>()
  const entryOfStop: number[] = []
  for (const { stop, post } of stops) {
    const place = stop.placeId ? places.get(stop.placeId) : undefined
    let index = place ? entryOfPlace.get(String(place._id)) : undefined
    if (index === undefined) {
      index = entries.push(place ? fromPlace(place, stats, stop.estCost ?? 0) : fromStop(stop, post)) - 1
      if (place) entryOfPlace.set(String(place._id), index)
    }
    entryOfStop.push(index)
  }

  // Then the destination's places inside its area: those that fit the interests first, best first.
  // All of them, not only those: the clone may only add what fits (validatePlan), but a chat
  // asking for a café must find one.
  const fits = (p: PlaceRecord) => (fitsInterests(p.category ?? null, form) ? 1 : 0)
  const extras = local
    .filter((p) => !entryOfPlace.has(String(p._id)))
    .filter((p) => !destination || p.lat == null || p.lng == null || distanceKm(destination, { lat: p.lat, lng: p.lng }) <= destination.radiusKm)
    .map((p) => ({ entry: fromPlace(p, stats, null), fits: fits(p) }))
    .sort((a, b) => b.fits - a.fits || b.entry.raw - a.entry.raw)
    .map((e) => e.entry)
    .slice(0, Math.max(0, AI_CONFIG.maxCandidates - entries.length))
  entries.push(...extras)

  const scores = scaleScores(entries.map((e) => e.raw))
  const candidates = entries.map((e, i) => ({ ...e.candidate, key: `P${i + 1}`, valueScore: scores[i] }))
  const sourceStops = stops.map(({ stop, dayIndex, post }, i) => ({
    key: `S${i + 1}`,
    postId: String(post._id),
    dayIndex,
    candidateKey: candidates[entryOfStop[i]].key,
    location: stop as Record<string, unknown>,
  }))
  return { candidates, sourceStops }
}
