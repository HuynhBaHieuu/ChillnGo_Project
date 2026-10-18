import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { plannedStops } from './draft.js'
import type { Candidate, Change, DraftState } from './draft.js'
import { feasibilityWarnings, openDuring, optimizeDay, planBFor, routeKm, seasonOf, travelMinutes } from './feasibility.js'
import { candidate, form } from './testFixture.js'

/** 0.0899° of latitude ≈ 10 km: places on one north–south line, `km` from the start. */
const at = (km: number) => ({ lat: 11.94 + (km / 10) * 0.0899, lng: 108.44 })

/** A draft whose stops are given directly: [place key, day, start, minutes]. */
function draftOf(candidates: Candidate[], stops: [string, number, string, number][], extra: Partial<DraftState> = {}): DraftState {
  const changes: Change[] = stops.map(([placeKey, dayIndex, startTime, durationMin], i) => ({
    changeId: `c${i + 1}`,
    type: 'add',
    sourceKey: null,
    placeKey,
    dayIndex,
    startTime,
    durationMin,
    reason: 'Thêm.',
    status: 'pending',
  }))
  return { formInput: form, candidates, sourceStops: [], changes, nextChange: changes.length + 1, ...extra }
}

const order = (state: DraftState, day = 1) =>
  plannedStops(state)
    .filter((s) => s.dayIndex === day)
    .map((s) => `${s.startTime} ${s.place.key}`)

describe('travel time', () => {
  it('is straight-line km at the configured speed, rounded up to 5 minutes, or unknown', () => {
    // 10 km at 25 km/h is 24 minutes.
    assert.equal(travelMinutes(candidate('A', at(0)), candidate('B', at(10))), 25)
    assert.equal(travelMinutes(candidate('A', at(0)), candidate('B', { lat: null, lng: null })), null)
  })
})

describe('opening hours', () => {
  const day = { open: '07:00', close: '17:00' }
  const night = { open: '18:00', close: '02:00' }
  const always = { open: '00:00', close: '23:59' }
  it('checks the whole visit, including hours past midnight', () => {
    assert.equal(openDuring(day, 8 * 60, 60), true)
    assert.equal(openDuring(day, 16 * 60 + 30, 60), false)
    assert.equal(openDuring(night, 23 * 60, 60), true)
    assert.equal(openDuring(night, 17 * 60, 60), false)
    assert.equal(openDuring(always, 22 * 60 + 30, 60), true)
    assert.equal(openDuring(null, 8 * 60, 60), null)
  })
})

describe('feasibility warnings', () => {
  it('flags a closed place, too little travel time and a day too long for its pace', () => {
    const state = draftOf(
      [
        candidate('P1', { name: 'Ga Đà Lạt', ...at(0), openingHours: { open: '06:00', close: '17:30' } }),
        candidate('P2', { name: 'Đồi chè', ...at(10) }),
        candidate('P3', { name: 'Chợ đêm', ...at(10) }),
      ],
      [
        ['P1', 1, '07:00', 60],
        ['P2', 1, '08:10', 60], // 10 km after only 10 minutes
        ['P3', 1, '19:30', 60], // the day runs 07:00–20:30
      ],
    )
    const relaxed = feasibilityWarnings(plannedStops(state), { days: 1, pace: 'relaxed' })
    assert.deepEqual(relaxed, [
      'Ngày 1: từ “Ga Đà Lạt” đến “Đồi chè” khoảng 10,0 km, cần chừng 25 phút đi lại (ước tính) nhưng chỉ có 10 phút.',
      'Ngày 1 kéo dài khoảng 13 giờ 30 phút, quá 8 giờ của nhịp thong thả.',
    ])
    state.changes[0].startTime = '17:00'
    state.changes[1].startTime = '18:30'
    const closed = feasibilityWarnings(plannedStops(state), { days: 1, pace: 'packed' })
    assert.deepEqual(closed, ['Ngày 1: “Ga Đà Lạt” mở 06:00–17:30, nhưng lịch là 17:00–18:00.'])
  })

  it('says nothing about what it does not know', () => {
    const state = draftOf(
      [candidate('P1', { lat: null, lng: null }), candidate('P2', at(10))],
      [
        ['P1', 1, '08:00', 60],
        ['P2', 1, '09:00', 60],
      ],
    )
    assert.deepEqual(feasibilityWarnings(plannedStops(state), { days: 1, pace: 'moderate' }), [])
  })
})

describe('route optimiser', () => {
  const sight = (key: string, km: number) => candidate(key, { category: 'sightseeing', ...at(km) })
  const zigzag = [sight('A', 0), sight('B', 10), sight('C', 1), sight('D', 11)]
  const slots: [string, number, string, number][] = [
    ['A', 1, '08:00', 60],
    ['B', 1, '10:00', 60],
    ['C', 1, '13:00', 60],
    ['D', 1, '16:00', 60],
  ]

  it('visits the nearest next, keeping each slot’s time', () => {
    const state = draftOf(zigzag, slots)
    const { state: next, result } = optimizeDay(state, 1)
    assert.deepEqual(order(next), ['08:00 A', '10:00 C', '13:00 B', '16:00 D'])
    assert.equal(result.changed, true)
    assert.ok(result.afterKm < result.beforeKm)
    assert.equal(Math.round(result.afterKm), Math.round(routeKm(plannedStops(next))))
    assert.deepEqual(order(state), ['08:00 A', '10:00 B', '13:00 C', '16:00 D'], 'the original is untouched')
  })

  it('keeps meals where they are', () => {
    const withLunch = zigzag.map((c) => (c.key === 'B' ? { ...c, category: 'food' } : c))
    const { state: next } = optimizeDay(draftOf(withLunch, slots), 1)
    assert.deepEqual(order(next), ['08:00 A', '10:00 B', '13:00 D', '16:00 C'])
  })

  it('changes nothing when the route is already the shortest', () => {
    const state = draftOf(zigzag, [
      ['A', 1, '08:00', 60],
      ['C', 1, '10:00', 60],
      ['B', 1, '13:00', 60],
      ['D', 1, '16:00', 60],
    ])
    const { state: next, result } = optimizeDay(state, 1)
    assert.equal(next, state)
    assert.equal(result.changed, false)
  })

  it('starts a stop later when the one before runs over', () => {
    const state = draftOf(zigzag, [
      ['A', 1, '08:00', 150], // until 10:30
      ['B', 1, '10:00', 60],
      ['C', 1, '13:00', 60],
      ['D', 1, '16:00', 60],
    ])
    const { state: next } = optimizeDay(state, 1)
    // C is 1 km from A: 5 minutes after 10:30.
    assert.deepEqual(order(next), ['08:00 A', '10:35 C', '13:00 B', '16:00 D'])
  })
})

describe('Plan B', () => {
  const stopAt = (state: DraftState) => plannedStops(state)[0]

  it('is the nearest unused place of the same category, open for the whole visit', () => {
    const state = draftOf(
      [
        candidate('P', { name: 'Quán A', category: 'cafe', ...at(0) }),
        candidate('Q', { name: 'Quán B', category: 'cafe', ...at(1), openingHours: { open: '07:00', close: '22:00' } }),
        candidate('R', { name: 'Quán C', category: 'cafe', ...at(0.5), openingHours: { open: '18:00', close: '23:00' } }),
        candidate('S', { name: 'Quán ăn', category: 'food', ...at(0.2), openingHours: { open: '07:00', close: '22:00' } }),
        candidate('T', { name: 'Quán D', category: 'cafe', ...at(0.1), openingHours: { open: '07:00', close: '22:00' } }),
      ],
      [
        ['P', 1, '09:00', 60],
        ['T', 1, '11:00', 60],
      ],
    )
    const used = new Set(['P', 'T'])
    const plan = planBFor(state, stopAt(state), used)
    assert.equal(plan?.place.key, 'Q')
    assert.equal(plan?.reason, 'Cùng loại cà phê, cách khoảng 1,0 km, mở cửa vào giờ này.')
  })

  it('prefers indoors for an outdoor stop in the rainy season', () => {
    const places = [
      candidate('P', { category: 'nature', isOutdoor: true, ...at(0) }),
      candidate('T', { category: 'nature', isOutdoor: true, ...at(0.3), openingHours: { open: '06:00', close: '18:00' } }),
      candidate('U', { category: 'nature', isOutdoor: false, ...at(2), openingHours: { open: '06:00', close: '18:00' } }),
    ]
    const dry = draftOf(places, [['P', 1, '09:00', 60]])
    const wet = draftOf(places, [['P', 1, '09:00', 60]], { season: { months: [7], rainy: true, peak: false, festivals: [] } })
    assert.equal(planBFor(dry, stopAt(dry), new Set(['P']))?.place.key, 'T')
    const plan = planBFor(wet, stopAt(wet), new Set(['P']))
    assert.equal(plan?.place.key, 'U')
    assert.match(plan!.reason, /trong nhà nếu trời mưa/)
  })

  it('is nothing when no place fits nearby', () => {
    const state = draftOf(
      [
        candidate('P', { category: 'cafe', ...at(0) }),
        candidate('Q', { category: 'cafe', ...at(40), openingHours: { open: '00:00', close: '23:59' } }),
        candidate('R', { category: 'cafe', ...at(1) }), // hours unknown: not known to be open
      ],
      [['P', 1, '09:00', 60]],
    )
    assert.equal(planBFor(state, stopAt(state), new Set(['P'])), null)
  })
})

describe('season', () => {
  const dalat = { rainyMonths: [5, 6, 7, 8, 9, 10], peakMonths: [12, 1, 2], festivals: [{ name: 'Festival Hoa Đà Lạt', month: 12 }] }

  it('reads the months the trip covers', () => {
    assert.deepEqual(seasonOf(dalat, { startDate: '2026-11-29', days: 3 }), {
      months: [11, 12],
      rainy: false,
      peak: true,
      festivals: [{ name: 'Festival Hoa Đà Lạt', month: 12 }],
    })
    assert.equal(seasonOf(dalat, { startDate: '2026-07-10', days: 2 })?.rainy, true)
  })

  it('says nothing without season data', () => {
    assert.equal(seasonOf(null, { startDate: '2026-07-10', days: 2 }), null)
    assert.equal(seasonOf({ rainyMonths: [], peakMonths: [], festivals: [] }, { startDate: '2026-07-10', days: 2 }), null)
  })
})
