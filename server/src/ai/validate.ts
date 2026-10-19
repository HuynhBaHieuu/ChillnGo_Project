/**
 * Checks on the model's output beyond its shape (schemas.ts): every id is one
 * it was given in this request, the days and times work out, and its text
 * holds no numbers it could have made up. Each returns the problems in words
 * the model can act on; an empty list means the output may be used.
 */

import { applyPatches, changesFromPlan, describeIssue, fitsInterests, plannedStops, timeIssues } from './draft.js'
import type { DraftState, PlannedStop } from './draft.js'
import type { ChatOutput, Plan } from './schemas.js'

type PlanContext = Pick<DraftState, 'formInput' | 'candidates' | 'sourceStops' | 'season'>

/**
 * Free text (reasons, chat replies) may not contain digits: prices, distances,
 * times and scores are the backend's to state. Place names may (“Cà phê 1960”),
 * as may the departure the user typed, so those are taken out first.
 */
export function textProblems(texts: { at: string; text: string }[], allowed: string[]): string[] {
  const phrases = allowed
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  const problems: string[] = []
  for (const { at, text } of texts) {
    let rest = text.toLowerCase()
    for (const phrase of phrases) rest = rest.split(phrase).join(' ')
    if (/\d/.test(rest)) {
      problems.push(
        `${at}: "${text}" contains digits. Write no numbers at all (no prices, distances, times, scores, day numbers or ids); say "rẻ hơn", "gần hơn", "ngày thứ hai"…`,
      )
    }
  }
  return problems
}

function allowedPhrases(ctx: PlanContext): string[] {
  return [...ctx.candidates.map((c) => c.name), ctx.formInput.departure, ...(ctx.season?.festivals.map((f) => f.name) ?? [])]
}

/**
 * A place may appear once, or as often as one source journey itself visited it
 * (its hotel, twice). Two merged journeys that both visit it still get it once.
 */
function duplicateProblems(ctx: PlanContext, stops: PlannedStop[]): string[] {
  const perJourney = new Map<string, number>()
  for (const s of ctx.sourceStops) {
    const key = `${s.postId}|${s.candidateKey}`
    perJourney.set(key, (perJourney.get(key) ?? 0) + 1)
  }
  const visitsInSource = new Map<string, number>()
  for (const [key, n] of perJourney) {
    const place = key.slice(key.indexOf('|') + 1)
    visitsInSource.set(place, Math.max(visitsInSource.get(place) ?? 0, n))
  }
  const counts = new Map<string, number>()
  for (const s of stops) counts.set(s.place.key, (counts.get(s.place.key) ?? 0) + 1)
  return [...counts]
    .filter(([key, n]) => n > Math.max(1, visitsInSource.get(key) ?? 0))
    .map(([key, n]) => `${key} appears ${n} times; a place may be visited only once.`)
}

/** The model's itinerary for an AI clone. */
export function validatePlan(plan: Plan, ctx: PlanContext): string[] {
  const days = ctx.formInput.days
  const candidates = new Map(ctx.candidates.map((c) => [c.key, c]))
  const sources = new Map(ctx.sourceStops.map((s) => [s.key, s]))
  const problems: string[] = []

  const indexes = plan.days.map((d) => d.dayIndex)
  const wanted = Array.from({ length: days }, (_, i) => i + 1)
  if (indexes.length !== days || !wanted.every((i) => indexes.includes(i))) {
    problems.push(`"days" must have exactly ${days} entries, dayIndex 1 to ${days}, each once; got [${indexes.join(', ')}].`)
  }

  const uses = new Map<string, number>()
  const use = (key: string) => uses.set(key, (uses.get(key) ?? 0) + 1)

  for (const day of plan.days) {
    if (day.stops.length === 0) problems.push(`Day ${day.dayIndex} has no stops.`)
    for (const stop of day.stops) {
      const at = `Day ${day.dayIndex}, ${stop.placeId}`
      if (!candidates.has(stop.placeId)) {
        problems.push(`${at}: placeId "${stop.placeId}" is not in candidates. Use only candidate ids (P1, P2…); never write place names.`)
        continue
      }
      const sourceKey = stop.sourceStopId ?? null
      const place = candidates.get(stop.placeId)!
      if (stop.action !== 'keep' && !place.inSource && !fitsInterests(place.category, ctx.formInput)) {
        problems.push(`${at}: ${stop.placeId} does not match form.interests; use only the candidates you were given.`)
      }
      if (stop.action === 'add') {
        if (sourceKey) problems.push(`${at}: "add" takes no sourceStopId; use "keep" or "replace" for a source stop.`)
        continue
      }
      const source = sourceKey ? sources.get(sourceKey) : undefined
      if (!source) {
        problems.push(`${at}: "${stop.action}" needs the sourceStopId (S1, S2…) of the source stop it keeps or replaces.`)
        continue
      }
      use(source.key)
      if (stop.action === 'keep' && stop.placeId !== source.candidateKey) {
        problems.push(`${at}: "keep" of ${source.key} must use its own placeId ${source.candidateKey}; use "replace" to change the place.`)
      }
      if (stop.action === 'replace' && stop.placeId === source.candidateKey) {
        problems.push(`${at}: "replace" of ${source.key} keeps the same place; use "keep".`)
      }
    }
  }

  for (const removed of plan.removed) {
    if (sources.has(removed.sourceStopId)) use(removed.sourceStopId)
    else problems.push(`removed: "${removed.sourceStopId}" is not a source stop id.`)
  }
  for (const [key, n] of uses) {
    if (n > 1) problems.push(`${key} is used ${n} times; each source stop appears once: kept, replaced or removed.`)
  }

  problems.push(
    ...textProblems(
      [
        ...plan.days.flatMap((d) => d.stops.map((s) => ({ at: `Day ${d.dayIndex}, ${s.placeId}, reason`, text: s.reason }))),
        ...plan.removed.map((r) => ({ at: `removed ${r.sourceStopId}, reason`, text: r.reason })),
      ],
      allowedPhrases(ctx),
    ),
  )
  if (problems.length) return problems

  // As a whole: times within each day, and no place twice.
  const stops = plannedStops({ ...ctx, ...changesFromPlan(plan, ctx) })
  return [...duplicateProblems(ctx, stops), ...timeIssues(stops).map(describeIssue)]
}

/**
 * Chat patches against the draft. Problems the draft already had (a stop the
 * user restored into a busy day) are not the model's: only new ones count.
 */
export function validatePatches(state: DraftState, output: ChatOutput): string[] {
  const planned = new Set(plannedStops(state).map((s) => s.change.changeId))
  const candidates = new Set(state.candidates.map((c) => c.key))
  const problems: string[] = []

  output.patches.forEach((patch, i) => {
    const at = `patches[${i}] (${patch.op})`
    if ('stopId' in patch && !planned.has(patch.stopId)) {
      problems.push(`${at}: stopId "${patch.stopId}" is not a stop of the draft; use the ids in draft.days[].stops[].id.`)
    }
    if ('placeId' in patch && !candidates.has(patch.placeId)) {
      problems.push(`${at}: placeId "${patch.placeId}" is not in candidates. Use only candidate ids (P1, P2…); never write place names.`)
    }
    if ('dayIndex' in patch && (patch.dayIndex < 1 || patch.dayIndex > state.formInput.days)) {
      problems.push(`${at}: dayIndex must be 1 to ${state.formInput.days}.`)
    }
  })
  problems.push(
    ...textProblems(
      [
        { at: 'reply', text: output.reply },
        ...output.patches.flatMap((p, i) => (p.reason ? [{ at: `patches[${i}].reason`, text: p.reason }] : [])),
      ],
      allowedPhrases(state),
    ),
  )
  if (problems.length) return problems

  let next: DraftState
  try {
    next = applyPatches(state, output.patches)
  } catch (error) {
    return [(error as Error).message]
  }
  const before = plannedStops(state)
  const after = plannedStops(next)
  const known = new Set([...duplicateProblems(state, before), ...timeIssues(before).map(describeIssue)])
  return [...duplicateProblems(next, after), ...timeIssues(after).map(describeIssue)].filter((p) => !known.has(p))
}
