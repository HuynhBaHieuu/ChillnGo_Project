import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AiOutputError } from './aiService.js'
import type { ChatFn } from './aiService.js'
import { applyChecklist, checklistItems, defaultChecklist, sortChecklist, tripTags, validateChecklist } from './checklist.js'
import type { DraftState } from './draft.js'
import { freshDraft } from './testFixture.js'

const templates = [
  { text: 'CCCD hoặc hộ chiếu', group: 'Giấy tờ', tags: ['all'] },
  { text: 'Đồ bơi', group: 'Quần áo', tags: ['beach'] },
  { text: 'Đồ ăn vặt cho bé', group: 'Sức khoẻ', tags: ['kids'] },
  { text: 'Thuốc chống côn trùng', group: 'Sức khoẻ', tags: ['nature'] },
  { text: 'Sạc dự phòng', group: 'Đồ dùng', tags: ['all'] },
]

function trip(): DraftState {
  const state = freshDraft()
  state.formInput = { ...state.formInput, withChildren: true }
  state.candidates = state.candidates.map((c) => (c.key === 'P2' ? { ...c, requiresBooking: true } : c))
  return state
}

describe('checklist from data', () => {
  it('tags the trip from its places, season and group', () => {
    const tags = tripTags(trip())
    for (const tag of ['all', 'nature', 'food', 'cafe', 'activity', 'kids']) assert.ok(tags.includes(tag), tag)
    assert.ok(!tags.includes('beach'))
  })

  it('picks the matching templates, then what needs booking', () => {
    const items = checklistItems(templates, trip())
    assert.deepEqual(
      items.map((i) => `${i.id} ${i.group}: ${i.text}`),
      [
        'i1 Giấy tờ: CCCD hoặc hộ chiếu',
        'i2 Sức khoẻ: Đồ ăn vặt cho bé',
        'i3 Sức khoẻ: Thuốc chống côn trùng',
        'i4 Đồ dùng: Sạc dự phòng',
        'b1 Đặt trước: Chợ đêm Đà Lạt',
      ],
    )
    assert.deepEqual(
      defaultChecklist(items).groups.map((g) => g.group),
      ['Đặt trước', 'Giấy tờ', 'Sức khoẻ', 'Đồ dùng'],
    )
  })
})

describe('checklist from the model', () => {
  const items = checklistItems(templates, trip())

  it('rejects an item or heading it was not given, and an item twice', () => {
    assert.deepEqual(validateChecklist({ groups: [{ group: 'Sức khoẻ', itemIds: ['i2', 'i3'] }] }, items), [])
    const problems = validateChecklist(
      {
        groups: [
          { group: 'Khác', itemIds: ['i1'] },
          { group: 'Đồ dùng', itemIds: ['i4', 'i99', 'i4'] },
        ],
      },
      items,
    )
    assert.equal(problems.length, 3)
    assert.match(problems.join(' | '), /"Khác" is not one of the given groups/)
    assert.match(problems.join(' | '), /"i99" is not a given item; never add items/)
    assert.match(problems.join(' | '), /"i4" is listed twice/)
  })

  it('keeps the model’s order and puts back what it left out', () => {
    const checklist = applyChecklist({ groups: [{ group: 'Sức khoẻ', itemIds: ['i3', 'i2'] }, { group: 'Đồ dùng', itemIds: ['i1'] }] }, items)
    assert.deepEqual(
      checklist.groups.map((g) => `${g.group}: ${g.items.map((i) => i.id).join(',')}`),
      ['Đặt trước: b1', 'Sức khoẻ: i3,i2', 'Đồ dùng: i1,i4'],
    )
    assert.equal(checklist.sortedByAi, true)
  })

  it('asks a (mocked) model and never accepts an added item', async () => {
    let calls = 0
    const adds: ChatFn = async () => {
      calls++
      return JSON.stringify({ groups: [{ group: 'Đồ dùng', itemIds: ['i4', 'i99'] }] })
    }
    await assert.rejects(sortChecklist(adds, items, trip()), AiOutputError)
    assert.equal(calls, 3)

    // Bookings are not the model’s to move: one offered back is an unknown id.
    const movesBooking: ChatFn = async () => JSON.stringify({ groups: [{ group: 'Đồ dùng', itemIds: ['b1'] }] })
    await assert.rejects(sortChecklist(movesBooking, items, trip()), AiOutputError)

    const orders: ChatFn = async () => JSON.stringify({ groups: [{ group: 'Đồ dùng', itemIds: ['i4'] }] })
    const checklist = await sortChecklist(orders, items, trip())
    assert.deepEqual(checklist.groups.map((g) => g.group), ['Đặt trước', 'Đồ dùng', 'Giấy tờ', 'Sức khoẻ'])
    assert.equal(checklist.groups.flatMap((g) => g.items).length, items.length)
  })
})
