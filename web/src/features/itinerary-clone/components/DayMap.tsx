import { X } from 'lucide-react'

import { MapPreview } from '@/components/MapPreview'
import { dayColor } from '@/features/map/geometry'
import { t } from '@/i18n'
import { isPinned } from '@/lib/itinerary'
import { cn } from '@/lib/utils'
import type { TripDay } from '@/services/types'

/**
 * "Tất cả · Ngày 1 · Ngày 2 …" in each day's map colour. `null` is the whole trip.
 */
export function DayPills({
  days,
  value,
  onChange,
  allLabel = true,
}: {
  days: TripDay[]
  value: number | null
  onChange: (index: number | null) => void
  /** Offer "Tất cả" (the whole trip) as the first pill. */
  allLabel?: boolean
}) {
  return (
    <nav aria-label={t('Chọn ngày')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {allLabel && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            value === null ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {t('Tất cả')}
        </button>
      )}
      {days.map((day, i) => {
        const color = dayColor(i + 1)
        const on = value === i
        return (
          <button
            key={day._id}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={on}
            className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-[filter]', !on && 'hover:brightness-95')}
            style={on ? { backgroundColor: color, color: '#fff' } : { color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {t('Ngày {n}', { n: i + 1 })}
          </button>
        )
      })}
    </nav>
  )
}

/** A day's label in its map colour, as on the map's pins. */
export function DayChip({ index }: { index: number }) {
  const color = dayColor(index + 1)
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {t('Ngày {n}', { n: index + 1 })}
    </span>
  )
}

/**
 * The map beside an itinerary, as tall as the screen. `focus` is the day it is
 * framed on (its stops and route), or null for every stop of the trip. Tapping
 * a stop focuses its day; the chip in the corner goes back to the whole trip.
 */
export function DayMap({
  days,
  focus,
  onFocus,
  title,
  className,
}: {
  days: TripDay[]
  focus: number | null
  onFocus: (index: number | null) => void
  title: string
  className?: string
}) {
  const day = focus === null ? undefined : days[focus]
  const nothingPinned = day !== undefined && day.locations.filter(isPinned).length === 0

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border', className)}>
      <MapPreview
        days={days}
        day={focus === null ? null : focus + 1}
        onDayChange={(n) => onFocus(n === null ? null : n - 1)}
        className="h-full w-full rounded-none"
        label={t('Bản đồ tuyến đường của {title}', { title })}
      />

      {focus !== null && (
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-md hover:bg-neutral-50"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(focus + 1) }} aria-hidden />
          <X className="size-3.5" aria-hidden />
          {t('Ngày {n}', { n: focus + 1 })} · {t('Hiện tất cả')}
        </button>
      )}

      {nothingPinned && (
        <p className="absolute inset-x-3 top-14 z-20 mx-auto w-fit max-w-[90%] rounded-xl bg-white/95 px-3 py-2 text-center text-xs text-neutral-700 shadow">
          {t('Ngày này chưa có điểm nào trên bản đồ. Chọn địa điểm từ ô tìm kiếm để ghim lên bản đồ.')}
        </p>
      )}
    </div>
  )
}
