import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AiOutputError, generateStructured } from './aiService.js'
import type { ChatFn } from './aiService.js'
import { changesFromPlan } from './draft.js'
import { chatOutputSchema, planSchema } from './schemas.js'
import type { ChatOutput, Plan } from './schemas.js'
import { base, freshDraft, validPlan } from './testFixture.js'
import { validatePatches, validatePlan } from './validate.js'

/** validPlan with one edit. */
function planWith(edit: (plan: Plan) => void): Plan {
  const plan = structuredClone(validPlan)
  edit(plan)
  return plan
}

describe('validatePlan', () => {
  it('accepts a plan that only uses the given ids', () => {
    assert.deepEqual(validatePlan(validPlan, base), [])
  })

  it('rejects a placeId outside the candidate set', () => {
    const problems = validatePlan(planWith((p) => (p.days[0].stops[1].placeId = 'P99')), base)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /P99.*not in candidates/)
  })

  it('rejects a place written as free text instead of an id', () => {
    const problems = validatePlan(planWith((p) => (p.days[0].stops[1].placeId = 'Quán bún bò Bà Tư')), base)
    assert.match(problems[0], /not in candidates/)
  })

  it('rejects a stop that carries a place name and no id (schema)', () => {
    const json = structuredClone(validPlan) as unknown as { days: { stops: Record<string, unknown>[] }[] }
    json.days[0].stops[1] = { name: 'Quán bún bò Bà Tư', startTime: '10:00', durationMin: 60, action: 'add', reason: 'Ngon.' }
    const parsed = planSchema.safeParse(json)
    assert.equal(parsed.success, false)
    const messages = parsed.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')
    assert.match(messages, /placeId/)
    assert.match(messages, /name/)
  })

  it('rejects the wrong number of days', () => {
    assert.match(validatePlan(planWith((p) => p.days.pop()), base)[0], /exactly 2 entries/)
    assert.match(validatePlan(planWith((p) => (p.days[1].dayIndex = 1)), base)[0], /exactly 2 entries/)
  })

  it('rejects overlapping stops', () => {
    // Hồ Xuân Hương runs 08:00–09:30; the café would start inside it.
    const problems = validatePlan(planWith((p) => (p.days[0].stops[1].startTime = '09:00')), base)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /overlaps/)
  })

  it('rejects stops outside the day', () => {
    assert.match(validatePlan(planWith((p) => (p.days[0].stops[0].startTime = '05:00')), base)[0], /before 06:00/)
    assert.match(validatePlan(planWith((p) => (p.days[0].stops[2].startTime = '22:30')), base)[0], /after 23:30/)
  })

  it('rejects a keep that changes the place, and a replace that does not', () => {
    assert.match(validatePlan(planWith((p) => (p.days[0].stops[0].placeId = 'P4')), base).join(), /"keep" of S1 must use its own placeId P1/)
    assert.match(validatePlan(planWith((p) => (p.days[1].stops[0].placeId = 'P3')), base).join(), /"replace" of S3 keeps the same place/)
  })

  it('rejects a source stop used twice', () => {
    const problems = validatePlan(planWith((p) => p.removed.push({ sourceStopId: 'S1', reason: 'Bỏ.' })), base)
    assert.match(problems.join(), /S1 is used 2 times/)
  })

  it('rejects a place visited twice', () => {
    const problems = validatePlan(
      planWith((p) => p.days[1].stops.push({ placeId: 'P4', startTime: '14:00', durationMin: 60, action: 'add', reason: 'Lại.' })),
      base,
    )
    assert.match(problems.join(), /P4 appears 2 times/)
  })

  it('rejects numbers in reasons, but not in place names', () => {
    const priced = validatePlan(planWith((p) => (p.days[0].stops[1].reason = 'Rẻ, chỉ 40.000đ.')), base)
    assert.match(priced[0], /contains digits/)
    assert.deepEqual(validatePlan(planWith((p) => (p.days[0].stops[1].reason = 'Cà phê 1960 gần hồ.')), base), [])
  })

  it('keeps a place two merged journeys share only once', () => {
    // A second journey that also visits the lake (P1), as S4.
    const merged = { ...base, sourceStops: [...base.sourceStops, { ...base.sourceStops[0], key: 'S4', postId: 'post-2' }] }
    const both = planWith((p) =>
      p.days[1].stops.push({ placeId: 'P1', startTime: '14:00', durationMin: 60, action: 'keep', sourceStopId: 'S4', reason: 'Giữ.' }),
    )
    assert.match(validatePlan(both, merged).join(), /P1 appears 2 times/)
    // One journey visiting it twice (its hotel) still may.
    const twice = { ...base, sourceStops: [...base.sourceStops, { ...base.sourceStops[0], key: 'S4' }] }
    assert.deepEqual(validatePlan(both, twice), [])
    // Left out, the shared stop is removed as a duplicate.
    const removed = changesFromPlan(validPlan, merged).changes.find((c) => c.sourceKey === 'S4')
    assert.equal(removed?.reason, 'Trùng với một điểm đã có trong lịch trình.')
  })

  it('only adds places that fit the chosen interests (or meals)', () => {
    const cafes = { ...base, formInput: { ...base.formInput, interests: ['cafe' as const] } }
    // P4 is a café; P5 (an activity) replaces S3 and fits nothing chosen.
    assert.match(validatePlan(validPlan, cafes).join(), /P5 does not match form.interests/)
    const noFalls = planWith((p) => (p.days[1].stops[0] = { ...p.days[1].stops[0], placeId: 'P3', action: 'keep' }))
    assert.deepEqual(validatePlan(noFalls, cafes), [])
  })

  it('treats a source stop the plan forgot as removed', () => {
    const plan = planWith((p) => p.days[1].stops.splice(0, 1, { placeId: 'P5', startTime: '09:00', durationMin: 60, action: 'add', reason: 'Thêm.' }))
    assert.deepEqual(validatePlan(plan, base), [])
    const removed = changesFromPlan(plan, base).changes.filter((c) => c.type === 'remove')
    assert.deepEqual(removed.map((c) => c.sourceKey), ['S3'])
  })
})

describe('validatePatches', () => {
  const output = (patches: ChatOutput['patches'], reply = 'Mình đã sửa lịch trình.'): ChatOutput => ({ reply, patches })

  it('accepts patches that name stops and candidates by id', () => {
    const state = freshDraft()
    const cafe = state.changes.find((c) => c.placeKey === 'P4')!.changeId
    assert.deepEqual(validatePatches(state, output([{ op: 'retime', stopId: cafe, startTime: '11:00', durationMin: 45 }])), [])
  })

  it('rejects a place that is not a candidate', () => {
    const problems = validatePatches(
      freshDraft(),
      output([{ op: 'add', placeId: 'Bánh tráng nướng Dì Đinh', dayIndex: 2, startTime: '15:00', durationMin: 60, reason: 'Ăn vặt.' }]),
    )
    assert.match(problems[0], /not in candidates/)
  })

  it('rejects an unknown stop and a day out of range', () => {
    const problems = validatePatches(freshDraft(), output([{ op: 'move', stopId: 'c99', dayIndex: 5, startTime: '09:00' }]))
    assert.equal(problems.length, 2)
  })

  it('rejects a patch that makes stops overlap', () => {
    const state = freshDraft()
    const lake = state.changes.find((c) => c.placeKey === 'P1')!.changeId
    const problems = validatePatches(state, output([{ op: 'retime', stopId: lake, startTime: '08:00', durationMin: 180 }]))
    assert.match(problems.join(), /overlaps/)
  })

  it('rejects digits in the reply', () => {
    assert.match(validatePatches(freshDraft(), output([], 'Tổng chi phí còn 500.000đ.'))[0], /contains digits/)
  })

  it('accepts an empty answer for a place ChillnGo has no data on', () => {
    const parsed = chatOutputSchema.parse({ reply: 'ChillnGo chưa có dữ liệu quán ăn chay ở đây.', patches: [] })
    assert.deepEqual(validatePatches(freshDraft(), parsed), [])
  })
})

describe('generateStructured with a mocked model', () => {
  /** A fake model answering from a script, never the real API. */
  function scripted(answers: string[]) {
    const seen: string[][] = []
    const chat: ChatFn = async (messages) => {
      seen.push(messages.map((m) => m.content))
      const answer = answers.shift()
      if (answer === undefined) throw new Error('no more answers')
      return answer
    }
    return { chat, seen }
  }

  const ask = (chat: ChatFn) =>
    generateStructured({ chat, task: 'test', system: 'system', messages: [{ role: 'user', content: 'plan' }], schema: planSchema, check: (p) => validatePlan(p, base) })

  it('sends the problems back and uses the corrected answer', async () => {
    const outside = JSON.stringify(planWith((p) => (p.days[0].stops[1].placeId = 'P99')))
    const { chat, seen } = scripted(['Đây là kế hoạch!', outside, `\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``])
    assert.deepEqual(await ask(chat), validPlan)
    assert.equal(seen.length, 3)
    assert.match(seen[1].at(-1)!, /not a valid JSON object/)
    assert.match(seen[2].at(-1)!, /P99/)
  })

  it('gives up after two retries without returning anything', async () => {
    const outside = JSON.stringify(planWith((p) => (p.days[0].stops[1].placeId = 'P99')))
    const { chat, seen } = scripted([outside, outside, outside, JSON.stringify(validPlan)])
    await assert.rejects(ask(chat), AiOutputError)
    assert.equal(seen.length, 3)
  })
})
