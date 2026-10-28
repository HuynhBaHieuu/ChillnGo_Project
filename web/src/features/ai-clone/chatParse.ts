import type { AiPace } from '@/services/types'

/** What the AI clone chat has learnt so far; missing fields use the defaults. */
export interface TripAnswers {
  startDate?: string
  days?: number
  groupSize?: number
  withChildren?: boolean
  withElderly?: boolean
  /** Null: no budget. */
  budget?: number | null
  departure?: string
  interests?: string[]
  pace?: AiPace
}

/** The questions, in the order the chat asks them. */
export type Slot = 'when' | 'days' | 'group' | 'budget' | 'departure' | 'interests' | 'pace' | 'merge'

/** Which question each answer field settles. */
export const SLOT_OF: Record<keyof TripAnswers, Slot> = {
  startDate: 'when',
  days: 'days',
  groupSize: 'group',
  withChildren: 'group',
  withElderly: 'group',
  budget: 'budget',
  departure: 'departure',
  interests: 'interests',
  pace: 'pace',
}

/** "Skip", "no", "don't know": the asked question keeps its default. */
export const SKIP = /^(bỏ qua|không|ko|k|no|skip|chưa biết|tuỳ|tùy|sao cũng được|không có)$/

const NOT_LETTER = '(?!\\p{L})'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(today: Date, n: number): string {
  return isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n)))
}

/** The coming Saturday (today if it is Saturday). */
export function thisWeekend(today: Date): string {
  return addDays(today, (6 - today.getUTCDay() + 7) % 7)
}

export function nextWeek(today: Date): string {
  return addDays(today, 7)
}

function parseDate(text: string, today: Date): string | undefined {
  // "/" and "-" only: "5.000.000" is money, not 5 January.
  const m = /(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?(?!\d)/.exec(text)
  if (m) {
    const [day, month] = [Number(m[1]), Number(m[2])]
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getUTCFullYear()
    let date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1) return undefined // 31/02
    // No year and already past: they mean next year.
    if (!m[3] && date < new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))) {
      year += 1
      date = new Date(Date.UTC(year, month - 1, day))
    }
    return isoDate(date)
  }
  if (/ngày mai|tomorrow/.test(text)) return addDays(today, 1)
  if (/tuần sau|tuần tới|next week/.test(text)) return nextWeek(today)
  if (/cuối tuần|weekend/.test(text)) return thisWeekend(today)
  return undefined
}

function parseBudget(text: string): number | null | undefined {
  if (/không giới hạn|thoải mái|no limit|unlimited|không có ngân sách/.test(text)) return null
  const million = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(triệu|tr|củ|m|million)${NOT_LETTER}`, 'u').exec(text)
  if (million) return Math.round(Number(million[1].replace(',', '.')) * 1_000_000)
  const thousand = new RegExp(`(\\d+)\\s*(k|nghìn|ngàn)${NOT_LETTER}`, 'u').exec(text)
  if (thousand) return Number(thousand[1]) * 1000
  const plain = /\d{1,3}(?:[.,]\d{3})+|\d{6,}/.exec(text)
  if (plain) return Number(plain[0].replace(/\D/g, ''))
  return undefined
}

function inRange(n: number, min: number, max: number): number | undefined {
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

/**
 * Reads whatever a chat reply says about the trip, in Vietnamese or plain
 * English: "3 ngày, 4 người có trẻ em, 5 triệu, từ Hà Nội". A bare number or
 * a bare place name is read as the answer to the question being asked.
 * Out-of-range values are left out, so the question is asked again.
 */
export function parseReply(
  raw: string,
  asking: Slot | null,
  interests: { value: string; label: string }[],
  today: Date,
): TripAnswers {
  const source = raw.normalize('NFC').trim()
  // Same length as `source` (Vietnamese letters lowercase one to one), so indexes carry over.
  const text = source.toLowerCase()
  const out: TripAnswers = {}

  const startDate = parseDate(text, today)
  if (startDate) out.startDate = startDate

  // "3 ngày", "3n2đ", "3 days"; not "2 người".
  const days = new RegExp(`(\\d{1,2})\\s*(?:ngày|n|days?)${NOT_LETTER}`, 'u').exec(text)
  if (days) out.days = inRange(Number(days[1]), 1, 14)

  const people = new RegExp(`(\\d{1,2})\\s*(?:người|ng|khách|pax|people|persons?)${NOT_LETTER}`, 'u').exec(text)
  if (people) out.groupSize = inRange(Number(people[1]), 1, 30)
  else if (/một mình|1 mình|solo|alone/.test(text)) out.groupSize = 1
  else if (/cặp đôi|vợ chồng|người yêu|couple|partner/.test(text)) out.groupSize = 2

  if (/không\s+(?:có\s+)?(?:trẻ|con|em bé)|no kids?/.test(text)) out.withChildren = false
  else if (/trẻ em|trẻ nhỏ|con nhỏ|em bé|kids?|child/.test(text)) out.withChildren = true
  if (/không\s+(?:có\s+)?(?:người già|người lớn tuổi)/.test(text)) out.withElderly = false
  else if (/người già|lớn tuổi|cao tuổi|ông bà|elderly|grandparents?/.test(text)) out.withElderly = true

  // A date's digits are not money.
  const budget = parseBudget(startDate ? text.replace(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/, '') : text)
  if (budget !== undefined) out.budget = budget

  // "từ Hà Nội", not "từ 20/11"; cut at punctuation or the next number.
  const from = /(?:^|\s)(?:từ|from)\s+(\p{L}[^,.;!?\n\d]*)/u.exec(text)
  if (from) {
    const end = from.index + from[0].length
    out.departure = source.slice(end - from[1].length, end).trim().slice(0, 100)
  }

  if (/thong thả|nhẹ nhàng|thư giãn|chill|relax|chậm rãi/.test(text)) out.pace = 'relaxed'
  else if (/dày đặc|nhiều điểm|đi nhiều|tối đa|packed/.test(text)) out.pace = 'packed'
  else if (/vừa phải|moderate/.test(text) || (asking === 'pace' && /vừa|bình thường|normal/.test(text))) out.pace = 'moderate'

  const picked = interests.filter((i) => text.includes(i.label.toLowerCase())).map((i) => i.value)
  if (picked.length) out.interests = picked
  else if (asking === 'interests' && /^(tất cả|all|gì cũng được)$/.test(text)) out.interests = []

  // A bare answer to the question being asked.
  const bare = /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : null
  if (bare !== null) {
    if (asking === 'days') out.days = inRange(bare, 1, 14)
    if (asking === 'group') out.groupSize = inRange(bare, 1, 30)
    // "5" for a budget means 5 million.
    if (asking === 'budget') out.budget = Math.round(bare < 1000 ? bare * 1_000_000 : bare)
  }
  if (asking === 'departure' && !out.departure && !SKIP.test(text) && !/\d/.test(text)) {
    out.departure = source.slice(0, 100)
  }

  for (const key of Object.keys(out) as (keyof TripAnswers)[]) {
    if (out[key] === undefined) delete out[key]
  }
  return out
}
