/**
 * Whether a draft's days work as planned, from the data alone (no model):
 * travel time between stops, opening hours, and how long each day runs for
 * its pace. Also the route optimiser, Plan B for each stop, and what the
 * destination's season data says about the trip.
 *
 * Travel time is straight-line distance ÷ AI_CONFIG.travelSpeedKmh: an
 * estimate, and every message about it says so. Unknown facts (no position, no
 * opening hours) produce no warning rather than a guess.
 */

import { addDays } from '../lib/journeys.js'
import { PLACE_CATEGORIES } from '../models/Place.js'
import type { PlaceCategory } from '../models/Place.js'
import { AI_CONFIG } from './config.js'
import { distanceKm, plannedStops, span, toMinutes, toTime } from './draft.js'
import type { Candidate, DraftState, OpeningHours, PlannedStop, SeasonFacts } from './draft.js'
import type { FormInput } from './schemas.js'

type Located = Candidate & { lat: number; lng: number }

function located(place: Candidate): place is Located {
  return place.lat !== null && place.lng !== null
}

/** "3,2" — Vietnamese decimal comma. */
function km1(km: number): string {
  return (Math.round(km * 10) / 10).toFixed(1).replace('.', ',')
}

function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} giờ ${m} phút` : `${h} giờ`
}

/** Straight-line km between two places; null when either has no position. */
export function kmBetween(a: Candidate, b: Candidate): number | null {
  return located(a) && located(b) ? distanceKm(a, b) : null
}

/** Estimated minutes from a to b, rounded up to 5; null when either has no position. */
export function travelMinutes(a: Candidate, b: Candidate): number | null {
  const km = kmBetween(a, b)
  return km === null ? null : Math.ceil(((km / AI_CONFIG.travelSpeedKmh) * 60) / 5) * 5
}

/**
 * Whether a visit from `start` (minutes after midnight) for `duration` minutes
 * falls inside the opening hours. A close earlier than the open runs past
 * midnight; 23:59 means until midnight. Null: the hours are not known.
 */
export function openDuring(hours: OpeningHours | null, start: number, duration: number): boolean | null {
  if (!hours) return null
  const open = toMinutes(hours.open)
  let close = toMinutes(hours.close)
  if (close === 23 * 60 + 59) close = 24 * 60
  if (close <= open) close += 24 * 60
  const end = start + duration
  return (start >= open && end <= close) || (start + 1440 >= open && end + 1440 <= close)
}

/** Closed during the visit, too little time to get to the next stop, a day too long for its pace. */
export function feasibilityWarnings(stops: PlannedStop[], form: Pick<FormInput, 'days' | 'pace'>): string[] {
  const pace = AI_CONFIG.pace[form.pace]
  const warnings: string[] = []
  for (let dayIndex = 1; dayIndex <= form.days; dayIndex++) {
    const day = stops.filter((s) => s.dayIndex === dayIndex)
    day.forEach((stop, i) => {
      const start = toMinutes(stop.startTime)
      const hours = stop.place.openingHours
      if (hours && openDuring(hours, start, stop.durationMin) === false) {
        warnings.push(`Ngày ${dayIndex}: “${stop.place.name}” mở ${hours.open}–${hours.close}, nhưng lịch là ${span(stop)}.`)
      }
      const next = day[i + 1]
      const travel = next ? travelMinutes(stop.place, next.place) : null
      if (!next || travel === null) return
      const gap = toMinutes(next.startTime) - (start + stop.durationMin)
      // A negative gap is an overlap, reported on its own.
      if (gap >= 0 && gap < travel) {
        warnings.push(
          `Ngày ${dayIndex}: từ “${stop.place.name}” đến “${next.place.name}” khoảng ${km1(kmBetween(stop.place, next.place)!)} km, cần chừng ${travel} phút đi lại (ước tính) nhưng chỉ có ${gap} phút.`,
        )
      }
    })
    if (day.length > 0) {
      const first = toMinutes(day[0].startTime)
      const last = Math.max(...day.map((s) => toMinutes(s.startTime) + s.durationMin))
      if (last - first > pace.activeHours * 60) {
        warnings.push(`Ngày ${dayIndex} kéo dài khoảng ${hoursText(last - first)}, quá ${pace.activeHours} giờ của nhịp ${pace.label.toLowerCase()}.`)
      }
    }
  }
  return warnings
}

/* ------------------------------------------------------------------ route */

export interface RouteResult {
  dayIndex: number
  beforeKm: number
  afterKm: number
  changed: boolean
}

/** Straight-line km along a day's stops, in order, between those with positions. */
export function routeKm(day: PlannedStop[]): number {
  let km = 0
  for (let i = 1; i < day.length; i++) km += kmBetween(day[i - 1].place, day[i].place) ?? 0
  return km
}

/** Stays where it is: a meal or the hotel, or a stop with no position to measure from. */
function isAnchor(stop: PlannedStop): boolean {
  return !located(stop.place) || (stop.place.category !== null && AI_CONFIG.anchorCategories.includes(stop.place.category))
}

const roundUp5 = (minutes: number) => Math.ceil(minutes / 5) * 5

/**
 * Reorders one day by nearest neighbour. The first stop stays (the day starts
 * there), as do meals, the hotel and stops with no position; every other slot
 * takes the closest remaining stop, preferring one that is open then. Each
 * slot keeps its start time, later if the stop before (plus the estimated
 * travel) runs over, so the day keeps its morning-to-evening shape. Nothing
 * changes unless the route gets shorter.
 */
export function optimizeDay(state: DraftState, dayIndex: number): { state: DraftState; result: RouteResult } {
  const next = structuredClone(state)
  const day = plannedStops(next).filter((s) => s.dayIndex === dayIndex)
  const beforeKm = routeKm(day)
  const unchanged = { state, result: { dayIndex, beforeKm, afterKm: beforeKm, changed: false } }
  if (day.length < 3) return unchanged

  const pool = day.filter((s, i) => i > 0 && !isAnchor(s))
  const order: PlannedStop[] = [day[0]]
  const starts: number[] = [toMinutes(day[0].startTime)]
  for (const slot of day.slice(1)) {
    const prev = order[order.length - 1]
    const prevEnd = starts[starts.length - 1] + prev.durationMin
    const arrival = (s: PlannedStop) => Math.max(toMinutes(slot.startTime), roundUp5(prevEnd + (travelMinutes(prev.place, s.place) ?? 0)))
    let stop = slot
    if (!isAnchor(slot)) {
      const ranked = pool
        .map((s) => ({ s, km: kmBetween(prev.place, s.place) ?? Infinity }))
        .sort((a, b) => a.km - b.km)
      stop = (ranked.find(({ s }) => openDuring(s.place.openingHours, arrival(s), s.durationMin) !== false) ?? ranked[0]).s
      pool.splice(pool.indexOf(stop), 1)
    }
    order.push(stop)
    starts.push(arrival(stop))
  }

  const afterKm = routeKm(order)
  if (afterKm >= beforeKm - 0.05) return unchanged
  order.forEach((stop, i) => {
    stop.change.startTime = toTime(starts[i])
  })
  return { state: next, result: { dayIndex, beforeKm, afterKm, changed: true } }
}

/* ----------------------------------------------------------------- plan B */

export interface PlanB {
  place: Candidate
  km: number
  reason: string
}

function categoryLabel(category: string): string {
  return PLACE_CATEGORIES[category as PlaceCategory] ?? category
}

/**
 * The fallback for a stop: the nearest place of the same category that is not
 * in the itinerary and is known to be open for the whole visit. When the trip
 * falls in the rainy season and the stop is outdoors, an indoor one wins.
 * Null when nothing fits. The reason is written here, from those facts.
 */
export function planBFor(state: DraftState, stop: PlannedStop, used: Set<string>): PlanB | null {
  const place = stop.place
  if (!place.category || !located(place)) return null
  const start = toMinutes(stop.startTime)
  const options = state.candidates
    .filter((c) => !used.has(c.key) && c.category === place.category && located(c))
    .filter((c) => openDuring(c.openingHours, start, stop.durationMin) === true)
    .map((c) => ({ place: c, km: distanceKm(place, c as Located) }))
    .filter((o) => o.km <= AI_CONFIG.planBMaxKm)
    .sort((a, b) => a.km - b.km)
  const wet = Boolean(state.season?.rainy) && place.isOutdoor === true
  const pick = (wet ? options.find((o) => o.place.isOutdoor === false) : undefined) ?? options[0]
  if (!pick) return null
  const indoor = wet && pick.place.isOutdoor === false
  return {
    ...pick,
    reason: `Cùng loại ${categoryLabel(place.category).toLowerCase()}, cách khoảng ${km1(pick.km)} km, mở cửa vào giờ này${indoor ? ', lại ở trong nhà nếu trời mưa' : ''}.`,
  }
}

/** Plan B for every stop of the draft, by change id. */
export function plansB(state: DraftState): Map<string, PlanB> {
  const stops = plannedStops(state)
  const used = new Set(stops.map((s) => s.place.key))
  const plans = new Map<string, PlanB>()
  for (const stop of stops) {
    const plan = planBFor(state, stop, used)
    if (plan) plans.set(stop.change.changeId, plan)
  }
  return plans
}

/* ----------------------------------------------------------------- season */

interface SeasonData {
  rainyMonths: number[]
  peakMonths: number[]
  festivals: { name?: string | null; month?: number | null }[]
}

/** What the destination's season data says about the trip's months; null without any data. */
export function seasonOf(destination: SeasonData | null, form: Pick<FormInput, 'startDate' | 'days'>): SeasonFacts | null {
  if (!destination) return null
  const { rainyMonths, peakMonths, festivals } = destination
  if (rainyMonths.length === 0 && peakMonths.length === 0 && festivals.length === 0) return null
  const months = [...new Set(Array.from({ length: form.days }, (_, i) => Number(addDays(form.startDate, i).slice(5, 7))))]
  return {
    months,
    rainy: months.some((m) => rainyMonths.includes(m)),
    peak: months.some((m) => peakMonths.includes(m)),
    festivals: festivals
      .filter((f): f is { name: string; month: number } => Boolean(f.name) && typeof f.month === 'number' && months.includes(f.month))
      .map(({ name, month }) => ({ name, month })),
  }
}
