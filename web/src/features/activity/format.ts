/**
 * Định dạng cho Hoạt động của bạn: thời gian tương đối, ngày giờ, số liệu
 * hành trình. Cùng tiếng Việt với phần còn lại của site (lib/format.ts).
 */

import type { TripPost } from '@/services/types'

const relative = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "2 giờ trước", "hôm qua", "vừa xong". */
export function timeAgo(iso: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'vừa xong'
}

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** "14:05 12 thg 3, 2026" */
export function dateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/** Whole days until `iso`, at least 0. */
export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / (24 * 3600 * 1000)))
}

/** "3 ngày". Tiếng Việt không chia số nhiều, nên chỉ ghép số với đơn vị. */
export function plural(count: number, unit: string): string {
  return `${count} ${unit}`
}

/** "3 ngày · 5 địa điểm" */
export function journeyStats(post: Pick<TripPost, 'days'>): string {
  const places = post.days.reduce((sum, day) => sum + day.locations.length, 0)
  return `${plural(post.days.length, 'ngày')} · ${plural(places, 'địa điểm')}`
}

/** "Đà Nẵng → Hội An", từ điểm dừng đầu và cuối có tên; null khi có ít hơn hai. */
export function journeyRoute(post: Pick<TripPost, 'days'>): string | null {
  const names = post.days.flatMap((day) => day.locations.map((l) => l.name.trim())).filter(Boolean)
  if (names.length < 2) return null
  const first = names[0]
  const last = names[names.length - 1]
  return first === last ? first : `${first} → ${last}`
}

/** "1:05:12" or "12:04" */
export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
