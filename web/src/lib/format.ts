import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

import type { BudgetLevel, Region, Season } from '@/services/types'

/** 1_910_000 → "1.910.000 ₫" */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** 1_910_000 → "1,9tr" — for tight spots like card badges. */
export function formatVndShort(amount: number): string {
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
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
}

/** "2025-10-16" → "Thứ Năm, 16 thg 10 2025" */
export function formatLongDate(date: string): string {
  return format(parseISO(date), 'EEEE, d MMM yyyy', { locale: vi })
}

/** "2025-10-16" → "16/10/2025" */
export function formatShortDate(date: string): string {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: vi })
}

/** "2025-10-16" + "2025-10-19" → "16 – 19 thg 10, 2025" */
export function formatDateRange(start: string, end: string): string {
  const from = parseISO(start)
  const to = parseISO(end)
  if (format(from, 'yyyy-MM') === format(to, 'yyyy-MM')) {
    return `${format(from, 'd', { locale: vi })} – ${format(to, 'd MMM, yyyy', { locale: vi })}`
  }
  return `${format(from, 'd MMM', { locale: vi })} – ${format(to, 'd MMM, yyyy', { locale: vi })}`
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

export const BUDGET_LABELS: Record<BudgetLevel, string> = {
  low: 'Tiết kiệm',
  medium: 'Vừa phải',
  high: 'Cao cấp',
}

export const REGION_LABELS: Record<Region, string> = {
  north: 'Miền Bắc',
  central: 'Miền Trung',
  south: 'Miền Nam',
  islands: 'Hải đảo',
  overseas: 'Nước ngoài',
}

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Mùa xuân',
  summer: 'Mùa hè',
  autumn: 'Mùa thu',
  winter: 'Mùa đông',
}

export const BUDGET_LEVELS: BudgetLevel[] = ['low', 'medium', 'high']
export const REGIONS: Region[] = ['north', 'central', 'south', 'islands', 'overseas']
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

/** "4N3Đ" from a day count. */
export function tripLengthLabel(dayCount: number): string {
  return `${dayCount}N${Math.max(0, dayCount - 1)}Đ`
}
