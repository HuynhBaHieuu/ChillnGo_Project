import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  acceptAll,
  applyPatches,
  costSummary,
  distanceKm,
  droppedStops,
  plannedStops,
  rawValue,
  scaleScores,
  setChangeStatus,
  stopCost,
} from './draft.js'
import type { DraftState } from './draft.js'
import { draftView, itineraryDays } from './view.js'
import { candidates, form, freshDraft } from './testFixture.js'

const placeOn = (state: DraftState, day: number) =>
  plannedStops(state)
    .filter((s) => s.dayIndex === day)
    .map((s) => `${s.startTime} ${s.place.key}`)

const changeFor = (state: DraftState, placeKey: string) => state.changes.find((c) => c.placeKey === placeKey)!

describe('distanceKm (haversine)', () => {
  it('is zero for the same point and about 1,140 km from Hà Nội to Sài Gòn', () => {
    assert.equal(distanceKm({ lat: 11.94, lng: 108.44 }, { lat: 11.94, lng: 108.44 }), 0)
    const km = distanceKm({ lat: 21.0285, lng: 105.8542 }, { lat: 10.7725, lng: 106.698 })
    assert.ok(km > 1120 && km < 1160, `got ${km}`)
  })
})

describe('value score', () => {
  it('grows with likes, clones and rating, and the best scales to 100', () => {
    const none = rawValue({ likes: 0, clones: 0, uses: 0 }, null)
    const liked = rawValue({ likes: 300, clones: 0, uses: 1 }, null)
    const cloned = rawValue({ likes: 300, clones: 50, uses: 1 }, 4.5)
    assert.ok(none < liked && liked < cloned)
    assert.deepEqual(scaleScores([0, cloned / 2, cloned]), [0, 50, 100])
    assert.deepEqual(scaleScores([0, 0]), [0, 0])
  })
})

describe('cost', () => {
  it('is avgCost × group, else the author’s cost, else unknown', () => {
    assert.equal(stopCost(candidates[1], 3), 300000) // avgCost 100,000 × 3
    assert.equal(stopCost(candidates[2], 3), 800000) // no Place: what the author spent
    assert.equal(stopCost(candidates[4], 3), null) // nothing known
  })

  it('sums known costs per day, counts the unknown, and checks the budget', () => {
    const stops = plannedStops(freshDraft())
    // Day 1: lake 0 + café 40,000×2 + market 100,000×2. Day 2: the falls, unknown.
    const cost = costSummary(stops, { ...form, budget: 250000 })
    assert.equal(cost.total, 280000)
    assert.equal(cost.missing, 1)
    assert.deepEqual(cost.perDay, [
      { dayIndex: 1, total: 280000, missing: 0 },
      { dayIndex: 2, total: 0, missing: 1 },
    ])
    assert.equal(cost.overBudget, true)
    assert.equal(costSummary(stops, form).overBudget, false)
  })
})

describe('diff: accept and revert', () => {
  it('labels each stop of the plan, and a keep needs no review', () => {
    const state = freshDraft()
    assert.deepEqual(
      state.changes.map((c) => `${c.type}:${c.status}`),
      ['keep:accepted', 'add:pending', 'keep:accepted', 'replace:pending'],
    )
    assert.ok(setChangeStatus(state, changeFor(state, 'P1').changeId, 'reverted'))
  })

  it('reverting a replace brings the original stop back in its slot', () => {
    const state = freshDraft()
    assert.equal(setChangeStatus(state, changeFor(state, 'P5').changeId, 'reverted'), null)
    assert.deepEqual(placeOn(state, 2), ['09:00 P3'])
    setChangeStatus(state, changeFor(state, 'P5').changeId, 'pending')
    assert.deepEqual(placeOn(state, 2), ['09:00 P5'])
  })

  it('reverting an add takes it out, and it can come back', () => {
    const state = freshDraft()
    const cafe = changeFor(state, 'P4').changeId
    setChangeStatus(state, cafe, 'reverted')
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '18:00 P2'])
    assert.deepEqual(droppedStops(state).map((d) => d.place.key), ['P4'])
    setChangeStatus(state, cafe, 'pending')
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '10:00 P4', '18:00 P2'])
  })

  it('reverting a remove restores the stop after the last one of its day', () => {
    const state = applyPatches(freshDraft(), [{ op: 'remove', stopId: changeFor(freshDraft(), 'P2').changeId, reason: 'Bỏ chợ đêm.' }])
    const removal = state.changes.find((c) => c.type === 'remove')!
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '10:00 P4'])
    setChangeStatus(state, removal.changeId, 'reverted')
    // The café ends at 11:00, so the market comes back at 11:00 for an hour.
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '10:00 P4', '11:00 P2'])
    setChangeStatus(state, removal.changeId, 'accepted')
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '10:00 P4'])
  })

  it('accept all clears every pending change; the view counts them', () => {
    const state = freshDraft()
    assert.equal(draftView(state).pendingCount, 2)
    acceptAll(state)
    assert.equal(draftView(state).pendingCount, 0)
  })

  it('the view warns about overlaps after a revert crowds a day', () => {
    const state = freshDraft()
    state.changes.find((c) => c.placeKey === 'P4')!.startTime = '08:30'
    assert.match(draftView(state).warnings[0], /Ngày 1: “Hồ Xuân Hương” \(08:00–09:30\) trùng giờ với “Cà phê 1960”/)
  })
})

describe('chat patches', () => {
  it('apply to a copy: add, replace, move, retime', () => {
    const state = freshDraft()
    const next = applyPatches(state, [
      { op: 'replace', stopId: changeFor(state, 'P4').changeId, placeId: 'P5', reason: 'Đổi sang thác.' },
      { op: 'move', stopId: changeFor(state, 'P2').changeId, dayIndex: 2, startTime: '18:00' },
      { op: 'retime', stopId: changeFor(state, 'P1').changeId, startTime: '07:00', durationMin: 60 },
    ])
    assert.deepEqual(placeOn(state, 1), ['08:00 P1', '10:00 P4', '18:00 P2'], 'the original is untouched')
    assert.deepEqual(placeOn(next, 1), ['07:00 P1', '10:00 P5'])
    assert.deepEqual(placeOn(next, 2), ['09:00 P5', '18:00 P2'])
  })

  it('removing a kept stop makes it a removal; adding it back restores it', () => {
    const state = freshDraft()
    const removed = applyPatches(state, [{ op: 'remove', stopId: changeFor(state, 'P1').changeId, reason: 'Không thích hồ.' }])
    const removal = removed.changes.find((c) => c.sourceKey === 'S1')!
    assert.equal(removal.type, 'remove')
    const back = applyPatches(removed, [{ op: 'add', placeId: 'P1', dayIndex: 2, startTime: '14:00', durationMin: 60, reason: 'Đi lại hồ.' }])
    assert.deepEqual(placeOn(back, 2), ['09:00 P5', '14:00 P1'])
    assert.equal(back.changes.find((c) => c.sourceKey === 'S1')!.status, 'reverted')
  })

  it('removing an added stop withdraws it entirely', () => {
    const state = freshDraft()
    const next = applyPatches(state, [{ op: 'remove', stopId: changeFor(state, 'P4').changeId, reason: 'Thôi.' }])
    assert.equal(next.changes.length, state.changes.length - 1)
  })

  it('refuses a patch on a stop an earlier patch took out', () => {
    const state = freshDraft()
    const cafe = changeFor(state, 'P4').changeId
    assert.throws(
      () => applyPatches(state, [
        { op: 'remove', stopId: cafe, reason: 'Bỏ.' },
        { op: 'retime', stopId: cafe, startTime: '12:00', durationMin: 30 },
      ]),
      /not in the draft/,
    )
  })
})

describe('commit', () => {
  it('keeps the author’s stop data, links places, and flags unknown costs', () => {
    const { days, total } = itineraryDays(freshDraft(), 'it1')
    assert.equal(days.length, 2)
    assert.equal(days[0].date, '2026-11-20')
    assert.equal(days[1].date, '2026-11-21')
    assert.equal(days[0].title, 'Hồ Xuân Hương → Chợ đêm Đà Lạt')

    const [lake, cafe, market] = days[0].locations
    assert.equal(lake._id, 'it1_d1_l1')
    assert.equal(lake.note, 'Đi bộ quanh hồ.', 'a kept stop keeps its author’s note')
    assert.equal(cafe.note, 'Gần hồ, hợp sở thích cà phê.', 'a new place carries the AI’s reason')
    assert.equal(cafe.placeId, 'place-P4')
    assert.equal(market.estCost, 200000)
    assert.equal(market.startTime, '18:00')

    const [falls] = days[1].locations
    assert.equal(falls.estCost, 0)
    assert.equal(falls.costUnknown, true)
    assert.equal(total, 280000)
  })
})
