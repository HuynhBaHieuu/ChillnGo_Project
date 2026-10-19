/**
 * What leaves a draft: the view the web app shows (days with their diff,
 * costs, warnings, Plan B, season) and the days saved on commit.
 */

import { addDays } from '../lib/journeys.js'
import { PLACE_CATEGORIES } from '../models/Place.js'
import type { PlaceCategory } from '../models/Place.js'
import { clock, costSummary, droppedStops, lookup, plannedStops, stopCost, timeIssues, toMinutes, warnIssue } from './draft.js'
import type { Candidate, DraftState } from './draft.js'
import { feasibilityWarnings, plansB } from './feasibility.js'
import type { PlanB } from './feasibility.js'

/* ------------------------------------------------------------------- view */

function placeView(place: Candidate, groupSize: number) {
  return {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    category: place.category ? (PLACE_CATEGORIES[place.category as PlaceCategory] ?? place.category) : null,
    avgCost: place.avgCost,
    priceLevel: place.priceLevel,
    openingHours: place.openingHours,
    isOutdoor: place.isOutdoor,
    requiresBooking: place.requiresBooking,
    rating: place.rating,
    photoUrl: place.photoUrl,
    valueScore: place.valueScore,
    inSource: place.inSource,
    cost: stopCost(place, groupSize),
    /** perPerson: avgCost × group; author: as the source journey's author wrote it; null: no data. */
    costBasis: place.avgCost !== null ? ('perPerson' as const) : place.authorCost !== null ? ('author' as const) : null,
  }
}

/** Overlaps and times outside the day, then what feasibility.ts finds: what the reader is warned about. */
export function warningsOf(state: DraftState): string[] {
  const stops = plannedStops(state)
  return [...timeIssues(stops).map(warnIssue), ...feasibilityWarnings(stops, state.formInput)]
}

/** The draft as the web app shows it: days with their diff labels, costs, warnings, Plan B and season. */
export function draftView(state: DraftState) {
  const form = state.formInput
  const stops = plannedStops(state)
  const cost = costSummary(stops, form)
  const planB = plansB(state)
  return {
    days: cost.perDay.map((day) => ({
      dayIndex: day.dayIndex,
      date: addDays(form.startDate, day.dayIndex - 1),
      cost: day,
      stops: stops
        .filter((s) => s.dayIndex === day.dayIndex)
        .map((s) => ({
          changeId: s.change.changeId,
          type: s.change.type,
          status: s.change.status,
          startTime: s.startTime,
          endTime: clock(toMinutes(s.startTime) + s.durationMin),
          durationMin: s.durationMin,
          reason: s.change.reason,
          place: placeView(s.place, form.groupSize),
          original: s.original ? placeView(s.original, form.groupSize) : null,
          planB: planBView(planB.get(s.change.changeId), form.groupSize),
        })),
    })),
    notInPlan: droppedStops(state).map(({ change, place }) => ({
      changeId: change.changeId,
      type: change.type,
      status: change.status,
      reason: change.reason,
      place: placeView(place, form.groupSize),
    })),
    cost: { total: cost.total, missing: cost.missing, budget: cost.budget, overBudget: cost.overBudget },
    warnings: warningsOf(state),
    season: state.season ?? null,
    pendingCount: state.changes.filter((c) => c.status === 'pending').length,
  }
}

/** Every stop's Plan B, for GET /api/ai-drafts/:id/plan-b. */
export function planBList(state: DraftState) {
  const plans = plansB(state)
  return plannedStops(state).flatMap((stop) => {
    const plan = planBView(plans.get(stop.change.changeId), state.formInput.groupSize)
    return plan ? [{ changeId: stop.change.changeId, dayIndex: stop.dayIndex, stop: stop.place.name, ...plan }] : []
  })
}

function planBView(plan: PlanB | undefined, groupSize: number) {
  if (!plan) return null
  return { place: placeView(plan.place, groupSize), distanceKm: Math.round(plan.km * 10) / 10, reason: plan.reason }
}

/* ----------------------------------------------------------------- commit */

/** Where a stop with no known position sits (UNPINNED in web/src/lib/itinerary.ts): left off maps. */
const UNPINNED = { lat: 16, lng: 106 }

/**
 * The itinerary's days (TripDay shape). A stop that is the source journey's
 * own keeps everything its author wrote (note, photo, travel mode); a new
 * place gets the Place's data and the AI's reason as its note.
 */
export function itineraryDays(state: DraftState, itineraryId: string) {
  const form = state.formInput
  const sources = lookup(state.sourceStops)
  const stops = plannedStops(state)
  const planB = plansB(state)

  const days = Array.from({ length: form.days }, (_, i) => {
    const dayIndex = i + 1
    const dayStops = stops.filter((s) => s.dayIndex === dayIndex)
    const locations = dayStops.map((stop, j): Record<string, unknown> & { _id: string; estCost: number } => {
      const source = stop.change.sourceKey ? sources.get(stop.change.sourceKey) : undefined
      const own = source && source.candidateKey === stop.place.key ? source.location : null
      const cost = stopCost(stop.place, form.groupSize)
      const base: Record<string, unknown> = own
        ? { ...own }
        : { name: stop.place.name, address: stop.place.address, note: stop.change.reason, photoUrl: stop.place.photoUrl }
      delete base.costUnknown
      return {
        ...base,
        _id: `${itineraryId}_d${dayIndex}_l${j + 1}`,
        lat: stop.place.lat ?? (own?.lat as number | undefined) ?? UNPINNED.lat,
        lng: stop.place.lng ?? (own?.lng as number | undefined) ?? UNPINNED.lng,
        estCost: cost ?? 0,
        ...(cost === null && { costUnknown: true }),
        ...(stop.place.placeId && { placeId: stop.place.placeId }),
        startTime: stop.startTime,
        durationMin: stop.durationMin,
        ...(planB.has(stop.change.changeId) && { planB: planBOf(planB.get(stop.change.changeId)!) }),
      }
    })
    const names = dayStops.map((s) => s.place.name)
    return {
      _id: `${itineraryId}_d${dayIndex}`,
      dayNumber: dayIndex,
      date: addDays(form.startDate, i),
      title: names.length > 1 ? `${names[0]} → ${names[names.length - 1]}` : (names[0] ?? ''),
      locations,
      photos: [] as string[],
    }
  })

  const total = days.reduce((sum, d) => sum + d.locations.reduce((s, l) => s + l.estCost, 0), 0)
  return { days, total }
}

/** A stop's Plan B as saved with it (TripLocation.planB). */
function planBOf(plan: PlanB) {
  return {
    name: plan.place.name,
    address: plan.place.address,
    ...(plan.place.placeId && { placeId: plan.place.placeId }),
    lat: plan.place.lat,
    lng: plan.place.lng,
    distanceKm: Math.round(plan.km * 10) / 10,
    reason: plan.reason,
  }
}
