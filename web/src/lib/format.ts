import { formatDistanceToNow, format, parseISO } from 'date-fns'

import { currentLocale, dateLocale, localeTag, t, translated } from '@/i18n'
import type { BudgetLevel, Region, Season } from '@/services/types'

/** 1_910_000 → "1.910.000 ₫" (Vietnamese), "₫1,910,000" (English). */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** 1_910_000 → "1,9tr" — for tight spots like card badges. Other languages: "₫1.9M", "₫191万". */
export function formatVndShort(amount: number): string {
  if (currentLocale() !== 'vi') {
    return new Intl.NumberFormat(localeTag(), {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10
    return `${String(rounded).replace('.', ',')}tr`
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`
  return String(amount)
}

/** 1284 → "1,3k" — like/bookmark counters. */
export function formatCount(count: number): string {
  if (currentLocale() !== 'vi') {
    return new Intl.NumberFormat(localeTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(count)
  }
  if (count >= 1_000_000) {
    return `${String(Math.round(count / 100_000) / 10).replace('.', ',')}tr`
  }
  if (count >= 1_000) {
    return `${String(Math.round(count / 100) / 10).replace('.', ',')}k`
  }
  return String(count)
}

/** "2025-10-22T13:20:00.000Z" → "khoảng 2 tháng trước" */
export function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: dateLocale() })
}

/** "2025-10-16" → "Thứ Năm, 16 thg 10 2025" */
export function formatLongDate(date: string): string {
  const pattern = currentLocale() === 'vi' ? 'EEEE, d MMM yyyy' : 'PPPP'
  return format(parseISO(date), pattern, { locale: dateLocale() })
}

/** "2025-10-16" → "16/10/2025" */
export function formatShortDate(date: string): string {
  const pattern = currentLocale() === 'vi' ? 'dd/MM/yyyy' : 'P'
  return format(parseISO(date), pattern, { locale: dateLocale() })
}

/** "2025-10-16" + "2025-10-19" → "16 – 19 thg 10, 2025" */
export function formatDateRange(start: string, end: string): string {
  const from = parseISO(start)
  const to = parseISO(end)
  if (currentLocale() !== 'vi') {
    return new Intl.DateTimeFormat(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(from, to)
  }
  const locale = dateLocale()
  if (format(from, 'yyyy-MM') === format(to, 'yyyy-MM')) {
    return `${format(from, 'd', { locale })} – ${format(to, 'd MMM, yyyy', { locale })}`
  }
  return `${format(from, 'd MMM', { locale })} – ${format(to, 'd MMM, yyyy', { locale })}`
}

/**
 * Lower-case and drop Vietnamese diacritics for search matching, so "ha giang"
 * finds "Hà Giang" and "da lat" finds "Đà Lạt" — most people type without them.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/* ------------------------------------------------- enum display mappings */

export const BUDGET_LABELS = translated<BudgetLevel>({
  low: 'Tiết kiệm',
  medium: 'Vừa phải',
  high: 'Cao cấp',
})

export const REGION_LABELS = translated<Region>({
  north: 'Miền Bắc',
  central: 'Miền Trung',
  south: 'Miền Nam',
  islands: 'Hải đảo',
  overseas: 'Nước ngoài',
})

export const SEASON_LABELS = translated<Season>({
  spring: 'Mùa xuân',
  summer: 'Mùa hè',
  autumn: 'Mùa thu',
  winter: 'Mùa đông',
})

export const BUDGET_LEVELS: BudgetLevel[] = ['low', 'medium', 'high']
export const REGIONS: Region[] = ['north', 'central', 'south', 'islands', 'overseas']
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

/** "4N3Đ" from a day count ("4D3N", "4天3晚", "3泊4日", "3박 4일"). */
export function tripLengthLabel(dayCount: number): string {
  return t('{days}N{nights}Đ', { days: dayCount, nights: Math.max(0, dayCount - 1) })
}
