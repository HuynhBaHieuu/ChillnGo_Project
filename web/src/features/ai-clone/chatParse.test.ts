// Run: node web/src/features/ai-clone/chatParse.test.ts (no test runner in web/).
import { parseReply, thisWeekend } from './chatParse.ts'
import type { Slot, TripAnswers } from './chatParse.ts'

const today = new Date('2026-10-27T00:00:00Z') // a Tuesday
const interests = [
  { value: 'food', label: 'Ẩm thực' },
  { value: 'cafe', label: 'Cà phê' },
]

function check(text: string, asking: Slot | null, expected: TripAnswers) {
  const got = JSON.stringify(parseReply(text, asking, interests, today))
  const want = JSON.stringify(expected)
  if (got !== want) throw new Error(`"${text}" (${asking}): got ${got}, want ${want}`)
}

check('3 ngày, 4 người có trẻ em, 5 triệu, từ Hà Nội', null, {
  days: 3, groupSize: 4, withChildren: true, budget: 5_000_000, departure: 'Hà Nội',
})
check('đi 3n2đ thong thả', null, { days: 3, pace: 'relaxed' })
check('2 người, không có trẻ em', null, { groupSize: 2, withChildren: false })
check('20/11', 'when', { startDate: '2026-11-20' })
check('1/3', 'when', { startDate: '2027-03-01' }) // already past this year
check('31/02', 'when', {})
check('cuối tuần này', 'when', { startDate: thisWeekend(today) })
check('khởi hành 20/11 ngân sách 5.000.000', null, { startDate: '2026-11-20', budget: 5_000_000 })
check('500k', 'budget', { budget: 500_000 })
check('1,5 triệu', 'budget', { budget: 1_500_000 })
check('5', 'budget', { budget: 5_000_000 })
check('không giới hạn', 'budget', { budget: null })
check('4', 'days', { days: 4 })
check('20', 'days', {}) // over 14: asked again
check('4', 'group', { groupSize: 4 })
check('một mình', 'group', { groupSize: 1 })
check('đi cùng ông bà', 'group', { withElderly: true })
check('Đà Nẵng', 'departure', { departure: 'Đà Nẵng' })
check('bỏ qua', 'departure', {})
check('đi từ 20/11, 2 ngày', null, { startDate: '2026-11-20', days: 2 })
check('ẩm thực và cà phê', 'interests', { interests: ['food', 'cafe'] })
check('tất cả', 'interests', { interests: [] })
check('vừa', 'pace', { pace: 'moderate' })
check('3 days for 2 people with kids', null, { days: 3, groupSize: 2, withChildren: true })
console.log('chatParse: all checks passed')
