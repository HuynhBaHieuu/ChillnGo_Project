import { localeTag, t, translated, tx } from '@/i18n'
import type { CatalogMeta } from '@/services/catalog.service'

/** Tags that are not place categories (those come labelled from the server). */
const TAG_LABELS = translated<string>({
  all: 'Mọi chuyến đi',
  beach: 'Biển',
  mountain: 'Núi',
  temple: 'Chùa – đền',
  water: 'Sông nước – thác',
  outdoor: 'Ngoài trời',
  rainy: 'Mùa mưa',
  peak: 'Mùa cao điểm',
  kids: 'Đi cùng trẻ em',
  elderly: 'Đi cùng người lớn tuổi',
})

export function categoryLabel(meta: CatalogMeta | undefined, key: string | null): string {
  if (!key) return t('Chưa rõ')
  const label = meta?.categories.find((c) => c.key === key)?.label
  return label ? tx(label) : key
}

export function tagLabel(meta: CatalogMeta | undefined, tag: string): string {
  return TAG_LABELS[tag] ?? categoryLabel(meta, tag)
}

/** "" → null; otherwise a number, or NaN when it is not one. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  return trimmed === '' ? null : Number(trimmed)
}

/**
 * A whole amount of money: "150.000", "150,000" and "150 000" all mean 150000.
 * "" → null; NaN when it is not one.
 */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(/[\s.,]/g, '')
  if (trimmed === '') return null
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

export function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function formatVnd(value: number | null): string {
  return value === null ? t('Chưa rõ') : `${new Intl.NumberFormat(localeTag()).format(value)} ₫`
}
