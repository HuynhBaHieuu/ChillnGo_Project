/**
 * An AI draft as plain data, and everything done to it that needs neither the
 * database nor the model: the diff built from a plan, accept / revert, chat
 * patches, costs, time checks, and the days saved on commit.
 *
 * Ids: candidates are P1, P2… (`Candidate.key`), the source journey's stops
 * S1, S2… (`SourceStop.key`), changes c1, c2…. The model only ever sees and
 * writes these; the real Place ids stay here.
 */

import { AI_CONFIG } from './config.js'
import type { FormInput, Patch, Plan } from './schemas.js'

export interface OpeningHours {
  open: string
  close: string
}

/** A place the model may use, with every fact it is told about it. */
export interface Candidate {
  key: string
  /** The Place, or null for a stop only the source journey knows (its data is the author's). */
  placeId: string | null
  name: string
  address: string
  lat: number | null
  lng: number | null
  category: string | null
  /** Per person, VND, from the Place. */
  avgCost: number | null
  /** What the source journey's author wrote down for this stop, VND. */
  authorCost: number | null
  priceLevel: number | null
  openingHours: OpeningHours | null
  isOutdoor: boolean | null
  requiresBooking: boolean | null
  rating: number | null
  photoUrl: string | null
  /** Trip kinds for the checklist (Place.tags). */
  tags: string[]
  /** 0–100, see AI_CONFIG.valueWeights. */
  valueScore: number
  /** Visited by the source journey. */
  inSource: boolean
}

/** A stop of the journey being cloned. */
export interface SourceStop {
  key: string
  postId: string
  /** 1-based day of its journey. */
  dayIndex: number
  candidateKey: string
  /** The stop as its author saved it (TripLocation). */
  location: Record<string, unknown>
}

export type ChangeType = 'keep' | 'replace' | 'add' | 'remove'
export type ChangeStatus = 'pending' | 'accepted' | 'reverted'

/**
 * One line of the diff. keep/replace/add are stops of the plan; remove is a
 * source stop left out. `reverted` undoes it: a replace shows the original
 * stop again, an add leaves the plan, a remove brings its stop back.
 */
export interface Change {
  changeId: string
  type: ChangeType
  sourceKey: string | null
  /** The proposed place (keep: the source stop's own; remove: null). */
  placeKey: string | null
  /** remove: the day a restored stop goes back to. */
  dayIndex: number
  /** Null while the stop is not in the plan (a remove that is not reverted). */
  startTime: string | null
  durationMin: number | null
  reason: string
  status: ChangeStatus
}

/** What the destination's season data says about the trip's months. Absent data says nothing. */
export interface SeasonFacts {
  months: number[]
  rainy: boolean
  peak: boolean
  festivals: { name: string; month: number }[]
}

export interface DraftState {
  formInput: FormInput
  candidates: Candidate[]
  sourceStops: SourceStop[]
  changes: Change[]
  nextChange: number
  /** Null when the journey has no destination with season data. */
  season?: SeasonFacts | null
}

/** A stop that is in the itinerary now, whatever change put it there. */
export interface PlannedStop {
  change: Change
  dayIndex: number
  startTime: string
  durationMin: number
  place: Candidate
  /** For a replace: the source stop's place. */
  original: Candidate | null
}

/* ------------------------------------------------------------------ units */

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "HH:mm", for a time of day: kept within the day. */
export function toTime(minutes: number): string {
  return clock(Math.min(Math.max(minutes, 0), 23 * 60 + 59))
}

/** "HH:mm" for any minute count, so an end past midnight reads 24:30. */
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Great-circle distance (haversine), km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/* ------------------------------------------------------------ value score */

export interface PlaceStats {
  likes: number
  clones: number
  uses: number
}

/** A place's worth before scaling: see AI_CONFIG.valueWeights. */
export function rawValue(stats: PlaceStats, rating: number | null): number {
  const w = AI_CONFIG.valueWeights
  return (
    w.likes * Math.log1p(stats.likes) +
    w.clones * Math.log1p(stats.clones) +
    w.uses * Math.log1p(stats.uses) +
    w.rating * (rating ?? 0)
  )
}

/** Scales raw values so the best is 100. */
export function scaleScores(raws: number[]): number[] {
  const max = Math.max(0, ...raws)
  return raws.map((raw) => (max > 0 ? Math.round((100 * raw) / max) : 0))
}

/** Whether a category is one the form asked for (or a meal). No interests chosen: all are. */
export function fitsInterests(category: string | null, form: Pick<FormInput, 'interests'>): boolean {
  if (form.interests.length === 0) return true
  return category !== null && (form.interests.includes(category as never) || AI_CONFIG.alwaysCategories.includes(category))
}

/* ------------------------------------------------------------------- cost */

/**
 * What a stop costs the group: the place's average per person × the group,
 * else what the source journey's author spent there (as written, for their
 * group), else unknown. Never estimated.
 */
export function stopCost(place: Candidate, groupSize: number): number | null {
  if (place.avgCost !== null) return place.avgCost * groupSize
  return place.authorCost
}

export interface CostSummary {
  total: number
  /** Stops with no cost data, left out of `total`. */
  missing: number
  perDay: { dayIndex: number; total: number; missing: number }[]
  budget: number | null
  overBudget: boolean
}

export function costSummary(stops: PlannedStop[], form: FormInput): CostSummary {
  const perDay = Array.from({ length: form.days }, (_, i) => ({ dayIndex: i + 1, total: 0, missing: 0 }))
  for (const stop of stops) {
    const day = perDay[stop.dayIndex - 1]
    const cost = stopCost(stop.place, form.groupSize)
    if (!day) continue
    if (cost === null) day.missing += 1
    else day.total += cost
  }
  const total = perDay.reduce((sum, d) => sum + d.total, 0)
  return {
    total,
    missing: perDay.reduce((sum, d) => sum + d.missing, 0),
    perDay,
    budget: form.budget,
    overBudget: form.budget !== null && total > form.budget,
  }
}

/* ------------------------------------------------------------------- plan */

export function lookup<T extends { key: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.key, item]))
}

/** The diff a validated plan makes against the source journey. */
export function changesFromPlan(
  plan: Plan,
  state: Pick<DraftState, 'formInput' | 'sourceStops'>,
  firstNo = 1,
): { changes: Change[]; nextChange: number } {
  let no = firstNo
  const sources = lookup(state.sourceStops)
  const used = new Set<string>()
  const changes: Change[] = []

  for (const day of plan.days) {
    for (const stop of day.stops) {
      const sourceKey = stop.action === 'add' ? null : (stop.sourceStopId ?? null)
      if (sourceKey) used.add(sourceKey)
      changes.push({
        changeId: `c${no++}`,
        type: stop.action,
        sourceKey,
        placeKey: stop.placeId,
        dayIndex: day.dayIndex,
        startTime: stop.startTime,
        durationMin: stop.durationMin,
        reason: stop.reason,
        // Nothing to review on a stop that stays as it was.
        status: stop.action === 'keep' ? 'accepted' : 'pending',
      })
    }
  }

  const removal = (source: SourceStop, reason: string): Change => ({
    changeId: `c${no++}`,
    type: 'remove',
    sourceKey: source.key,
    placeKey: null,
    dayIndex: Math.min(source.dayIndex, state.formInput.days),
    startTime: null,
    durationMin: null,
    reason,
    status: 'pending',
  })
  for (const removed of plan.removed) {
    const source = sources.get(removed.sourceStopId)
    if (!source || used.has(source.key)) continue
    used.add(source.key)
    changes.push(removal(source, removed.reason))
  }
  // A source stop the plan left out is removed: say so. In a merge it is often the same place
  // another journey brought along.
  const planned = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.placeId)))
  for (const source of state.sourceStops) {
    if (used.has(source.key)) continue
    const reason = planned.has(source.candidateKey) ? 'Trùng với một điểm đã có trong lịch trình.' : 'Không có trong lịch trình AI đề xuất.'
    changes.push(removal(source, reason))
  }

  return { changes, nextChange: no }
}

/** The stops of the itinerary as it stands, by day and time. */
export function plannedStops(state: Pick<DraftState, 'candidates' | 'sourceStops' | 'changes'>): PlannedStop[] {
  const candidates = lookup(state.candidates)
  const sources = lookup(state.sourceStops)
  const stops: PlannedStop[] = []

  for (const change of state.changes) {
    const source = change.sourceKey ? sources.get(change.sourceKey) : undefined
    const sourcePlace = source ? (candidates.get(source.candidateKey) ?? null) : null
    const proposed = change.placeKey ? (candidates.get(change.placeKey) ?? null) : null
    const reverted = change.status === 'reverted'

    let place: Candidate | null = null
    if (change.type === 'keep') place = proposed
    if (change.type === 'replace') place = reverted ? sourcePlace : proposed
    if (change.type === 'add') place = reverted ? null : proposed
    if (change.type === 'remove') place = reverted ? sourcePlace : null
    if (!place || change.startTime === null || change.durationMin === null) continue

    stops.push({
      change,
      dayIndex: change.dayIndex,
      startTime: change.startTime,
      durationMin: change.durationMin,
      place,
      original: change.type === 'replace' ? sourcePlace : null,
    })
  }

  return stops.sort((a, b) => a.dayIndex - b.dayIndex || toMinutes(a.startTime) - toMinutes(b.startTime))
}

/** Places the AI took out (removed source stops) or the user turned down (reverted adds). */
export function droppedStops(state: DraftState): { change: Change; place: Candidate }[] {
  const candidates = lookup(state.candidates)
  const sources = lookup(state.sourceStops)
  const dropped: { change: Change; place: Candidate }[] = []
  for (const change of state.changes) {
    let key: string | null = null
    if (change.type === 'remove' && change.status !== 'reverted') key = sources.get(change.sourceKey ?? '')?.candidateKey ?? null
    if (change.type === 'add' && change.status === 'reverted') key = change.placeKey
    const place = key ? candidates.get(key) : undefined
    if (place) dropped.push({ change, place })
  }
  return dropped
}

/* ------------------------------------------------------------ time checks */

export interface TimeIssue {
  kind: 'overlap' | 'early' | 'late'
  stop: PlannedStop
  /** overlap: the stop it runs into. */
  next?: PlannedStop
}

/** Stops that start too early, end too late, or run into the next one (`stops` as plannedStops sorts them). */
export function timeIssues(stops: PlannedStop[]): TimeIssue[] {
  const dayStart = toMinutes(AI_CONFIG.dayStart)
  const dayEnd = toMinutes(AI_CONFIG.dayEnd)
  const issues: TimeIssue[] = []
  stops.forEach((stop, i) => {
    const start = toMinutes(stop.startTime)
    const end = start + stop.durationMin
    if (start < dayStart) issues.push({ kind: 'early', stop })
    if (end > dayEnd) issues.push({ kind: 'late', stop })
    const next = stops[i + 1]
    if (next && next.dayIndex === stop.dayIndex && toMinutes(next.startTime) < end) {
      issues.push({ kind: 'overlap', stop, next })
    }
  })
  return issues
}

export function span(stop: PlannedStop): string {
  const start = toMinutes(stop.startTime)
  return `${stop.startTime}–${clock(start + stop.durationMin)}`
}

/** For the model, by id. */
export function describeIssue(issue: TimeIssue): string {
  const { stop, next } = issue
  const at = `Day ${stop.dayIndex}: ${stop.change.changeId} (${stop.place.key}, ${span(stop)})`
  if (issue.kind === 'early') return `${at} starts before ${AI_CONFIG.dayStart}.`
  if (issue.kind === 'late') return `${at} ends after ${AI_CONFIG.dayEnd}.`
  return `${at} overlaps ${next?.change.changeId} (${next?.place.key}) starting ${next?.startTime}. Leave time to travel between stops.`
}

/** For the reader, by name. */
export function warnIssue(issue: TimeIssue): string {
  const { stop, next } = issue
  const name = `“${stop.place.name}” (${span(stop)})`
  if (issue.kind === 'early') return `Ngày ${stop.dayIndex}: ${name} bắt đầu sớm hơn ${AI_CONFIG.dayStart}.`
  if (issue.kind === 'late') return `Ngày ${stop.dayIndex}: ${name} kết thúc muộn hơn ${AI_CONFIG.dayEnd}.`
  return `Ngày ${stop.dayIndex}: ${name} trùng giờ với “${next?.place.name}” (bắt đầu ${next?.startTime}).`
}

/* ---------------------------------------------------------- review status */

/** Where a restored stop goes when its day is empty. */
const RESTORE_AT = '08:00'

/**
 * Accept, revert or reset one change. Returns a message for the reader when it
 * cannot be done. Reverting a remove brings the stop back after the last stop
 * of its day.
 */
export function setChangeStatus(state: DraftState, changeId: string, status: ChangeStatus): string | null {
  const change = state.changes.find((c) => c.changeId === changeId)
  if (!change) return 'Không tìm thấy thay đổi này trong bản nháp.'
  if (change.type === 'keep') return 'Điểm này được giữ nguyên, không có gì để hoàn tác.'
  if (change.status === status) return null

  if (change.type === 'remove') {
    if (status === 'reverted') {
      const sameDay = plannedStops(state).filter((s) => s.dayIndex === change.dayIndex)
      const lastEnd = Math.max(toMinutes(RESTORE_AT), ...sameDay.map((s) => toMinutes(s.startTime) + s.durationMin))
      const duration = AI_CONFIG.restoredDurationMin
      // On the quarter hour, and never past the end of the day (an overlap is then flagged instead).
      const start = Math.min(Math.ceil(lastEnd / 15) * 15, toMinutes(AI_CONFIG.dayEnd) - duration)
      change.startTime = toTime(start)
      change.durationMin = duration
    } else {
      change.startTime = null
      change.durationMin = null
    }
  }
  change.status = status
  return null
}

export function acceptAll(state: DraftState): void {
  for (const change of state.changes) if (change.status === 'pending') change.status = 'accepted'
}

/* ---------------------------------------------------------- chat patches */

/**
 * Applies chat patches to a copy of the draft. Throws, with a message for the
 * model, when a patch names a stop an earlier patch already took out.
 * Checked beforehand by validatePatches (validate.ts).
 */
export function applyPatches(state: DraftState, patches: Patch[]): DraftState {
  const next = structuredClone(state)
  const sources = lookup(next.sourceStops)
  const ownPlace = (change: Change) => (change.sourceKey ? sources.get(change.sourceKey)?.candidateKey : undefined)

  const stopOf = (stopId: string): Change => {
    const planned = plannedStops(next).find((s) => s.change.changeId === stopId)
    if (!planned) throw new Error(`Stop ${stopId} is not in the draft (any more).`)
    return planned.change
  }

  for (const patch of patches) {
    switch (patch.op) {
      case 'add': {
        const at = { dayIndex: patch.dayIndex, startTime: patch.startTime, durationMin: patch.durationMin, reason: patch.reason }
        // A source stop the AI took out comes back as itself; an add the user turned down is offered again.
        const removed = next.changes.find((c) => c.type === 'remove' && c.status !== 'reverted' && ownPlace(c) === patch.placeId)
        const declined = next.changes.find((c) => c.type === 'add' && c.status === 'reverted' && c.placeKey === patch.placeId)
        if (removed) Object.assign(removed, at, { status: 'reverted' })
        else if (declined) Object.assign(declined, at, { status: 'pending' })
        else {
          next.changes.push({
            changeId: `c${next.nextChange++}`,
            type: 'add',
            sourceKey: null,
            placeKey: patch.placeId,
            ...at,
            status: 'pending',
          })
        }
        break
      }
      case 'remove': {
        const change = stopOf(patch.stopId)
        if (change.type === 'add') {
          next.changes.splice(next.changes.indexOf(change), 1)
        } else {
          // A kept, replaced or restored source stop: now a removal of that stop.
          Object.assign(change, { type: 'remove', placeKey: null, startTime: null, durationMin: null, reason: patch.reason, status: 'pending' })
        }
        break
      }
      case 'replace': {
        const change = stopOf(patch.stopId)
        if (change.type === 'add') Object.assign(change, { placeKey: patch.placeId, reason: patch.reason, status: 'pending' })
        else if (ownPlace(change) === patch.placeId) Object.assign(change, { type: 'keep', placeKey: patch.placeId, reason: patch.reason, status: 'accepted' })
        else Object.assign(change, { type: 'replace', placeKey: patch.placeId, reason: patch.reason, status: 'pending' })
        break
      }
      case 'move': {
        Object.assign(stopOf(patch.stopId), { dayIndex: patch.dayIndex, startTime: patch.startTime })
        break
      }
      case 'retime': {
        Object.assign(stopOf(patch.stopId), { startTime: patch.startTime, durationMin: patch.durationMin })
        break
      }
    }
  }
  return next
}
