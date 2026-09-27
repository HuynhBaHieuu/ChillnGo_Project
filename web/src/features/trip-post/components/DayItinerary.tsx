import { MapPin } from 'lucide-react'

import { GlassCard } from '@/components/GlassCard'
import { googleMapsUrl } from '@/lib/geo'
import { dayCostOf, isPinned } from '@/lib/itinerary'
import { formatLongDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripDay } from '@/services/types'

interface DayItineraryProps {
  day: TripDay
  className?: string
}

/**
 * One day of a trip: date header, the ordered list of stops with note,
 * estimated cost and photo, and a horizontal strip of the day's photos.
 */
export function DayItinerary({ day, className }: DayItineraryProps) {
  return (
    <GlassCard as="section" className={cn('p-6 sm:p-8', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-sm text-muted-foreground">
            Ngày {day.dayNumber}
          </p>
          <h3 className="mt-1 font-display text-xl">
            {day.title}
          </h3>
          <time dateTime={day.date} className="mt-1 block text-sm text-muted-foreground">
            {formatLongDate(day.date)}
          </time>
        </div>
        <p className="text-sm text-muted-foreground">
          Ước tính{' '}
          <span className="text-foreground">{formatVnd(dayCostOf(day))}</span>
        </p>
      </header>

      {/* Stops, drawn as a timeline. */}
      <ol className="mt-8 space-y-0">
        {day.locations.map((location, index) => (
          <li key={location._id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Connector line, hidden on the last stop. */}
            {index < day.locations.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-border"
              />
            )}

            <span className="relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-medium">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <h4 className="font-medium">{location.name}</h4>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {location.estCost > 0 ? formatVnd(location.estCost) : 'Miễn phí'}
                </span>
              </div>
              {(location.address || isPinned(location)) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0 text-[hsl(var(--np-ochre))]" aria-hidden />
                  {location.address && <span>{location.address}</span>}
                  {isPinned(location) && (
                    <a
                      href={googleMapsUrl(location.lat, location.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Chỉ đường
                    </a>
                  )}
                </p>
              )}
              {location.note && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {location.note}
                </p>
              )}
              {location.photoUrl && (
                <a
                  href={location.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Xem ảnh ${location.name || `điểm dừng ${index + 1}`} cỡ lớn`}
                  className="np-media group mt-3 block aspect-[16/10] w-full max-w-md overflow-hidden rounded-xl bg-np-well"
                >
                  <img
                    src={location.photoUrl}
                    alt={location.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {day.photos.length > 0 && (
        <div className="no-scrollbar -mx-6 mt-2 flex gap-3 overflow-x-auto px-6 sm:-mx-8 sm:px-8">
          {day.photos.map((photo) => (
            <img
              key={photo}
              src={photo}
              alt=""
              loading="lazy"
              className="h-32 w-44 shrink-0 rounded-2xl object-cover sm:h-40 sm:w-56"
            />
          ))}
        </div>
      )}
    </GlassCard>
  )
}
