import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DayChip, DayMap, DayPills } from '@/features/itinerary-clone/components/DayMap'
import { useSharedItinerary } from '@/features/itinerary-clone/hooks'
import { localeTag, t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { tr } from '@/i18n/rich'
import { translateServerMessage } from '@/i18n/server'
import { formatLongDate, formatShortDate, formatVnd, tripLengthLabel } from '@/lib/format'
import { dayCostOf } from '@/lib/itinerary'
import type { ItineraryStatus, TripDay } from '@/services/types'

const STATUS_LABELS: Record<ItineraryStatus, MessageKey> = {
  planning: 'Đang lên kế hoạch',
  confirmed: 'Đã chốt',
  completed: 'Đã đi',
}

/**
 * An itinerary someone shared by link: read-only, no account needed. The days
 * on the left, the map on the right; picking a day shows its stops and route.
 */
export function SharedItineraryPage() {
  const { token } = useParams<{ token: string }>()
  const { data: itinerary, isPending, isError } = useSharedItinerary(token)
  // One day on its own, or every day (null). The map follows `focus`.
  const [onlyDay, setOnlyDay] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const sectionRefs = useRef(new Map<number, HTMLElement>())
  // While the page scrolls itself to a picked day, reading position does not move the map.
  const locked = useRef<number | null>(null)

  // Reading the whole trip: the map follows the day being read (the last one
  // whose heading is above a line a third of the way down the screen).
  useEffect(() => {
    if (onlyDay !== null) return
    let frame = 0
    const update = () => {
      frame = 0
      if (locked.current !== null) return
      const line = window.innerHeight * 0.35
      let active: number | null = null
      if (window.scrollY > 120) {
        for (const [i, el] of sectionRefs.current) {
          if (el.getBoundingClientRect().top <= line && (active === null || i > active)) active = i
        }
      }
      setFocus((prev) => (prev === active ? prev : active))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [onlyDay, itinerary])

  if (isPending) {
    return (
      <PageContainer wide>
        <Skeleton className="h-12 w-96" />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </PageContainer>
    )
  }

  if (isError || !itinerary) {
    return (
      <PageContainer wide>
        <EmptyState
          title={t('Link chia sẻ không còn hiệu lực')}
          description={t('Người chia sẻ có thể đã tắt link này. Hãy xin họ link mới.')}
          action={
            <Button asChild variant="outline">
              <Link to="/discover">{t('Khám phá hành trình')}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const days = itinerary.days

  /** "Tất cả" or one day on its own, from the pills. */
  function viewDay(index: number | null) {
    setOnlyDay(index)
    setFocus(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** A stop tapped on the map: frame its day and bring it into view. */
  function pickFromMap(index: number | null) {
    if (onlyDay !== null) {
      if (index !== null) setOnlyDay(index)
      else setOnlyDay(null)
      setFocus(index)
      return
    }
    setFocus(index)
    if (index === null) return
    if (locked.current !== null) window.clearTimeout(locked.current)
    locked.current = window.setTimeout(() => {
      locked.current = null
    }, 900)
    sectionRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PageContainer wide>
      <header className="animate-fade-rise">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(STATUS_LABELS[itinerary.status])}</Badge>
          <span className="text-xs text-muted-foreground">
            {tripLengthLabel(days.length)} · {t('khởi hành {date}', { date: formatShortDate(itinerary.startDate) })}
          </span>
        </div>
        <h1 className="mt-4 max-w-[28ch] font-display text-4xl tracking-tight">{itinerary.title}</h1>
        {itinerary.owner && (
          <p className="mt-3 text-sm text-muted-foreground">
            {tr('Lịch trình của {name}', {
              name: <span className="text-foreground">{itinerary.owner.displayName}</span>,
            })}
          </p>
        )}
        {itinerary.note && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {translateServerMessage(itinerary.note)}
          </p>
        )}
      </header>

      <div className="animate-fade-rise-delay mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:items-start">
        <section className="order-last min-w-0 lg:order-first">
          {days.length > 1 && (
            <div className="sticky top-20 z-10 -mx-2 rounded-2xl bg-background/90 px-2 py-2 backdrop-blur">
              <DayPills days={days} value={onlyDay} onChange={viewDay} />
            </div>
          )}

          <div className="space-y-6">
            {days.map((day, index) =>
              onlyDay !== null && onlyDay !== index ? null : (
                <section
                  key={day._id}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(index, el)
                    else sectionRefs.current.delete(index)
                  }}
                  onClick={() => focus !== index && pickFromMap(index)}
                  className={
                    'scroll-mt-36 pt-4 transition-opacity duration-300 ' +
                    (onlyDay === null && focus !== null && focus !== index ? 'cursor-pointer opacity-40 hover:opacity-70' : '')
                  }
                >
                  <DayCard day={day} index={index} />
                </section>
              ),
            )}
          </div>

          {onlyDay !== null && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button type="button" variant="outline" disabled={onlyDay === 0} onClick={() => viewDay(onlyDay - 1)} className="disabled:invisible">
                ← {t('Ngày {n}', { n: onlyDay })}
              </Button>
              <Button type="button" onClick={() => viewDay(onlyDay + 1 < days.length ? onlyDay + 1 : null)}>
                {onlyDay + 1 < days.length ? `${t('Ngày {n}', { n: onlyDay + 2 })} →` : t('Tất cả')}
              </Button>
            </div>
          )}

          {onlyDay === null && (
            <div className="mt-8 flex items-center justify-between gap-3 rounded-2xl bg-foreground px-5 py-4 text-background">
              <span className="text-sm font-medium">{t('Tổng chi phí ước tính')}</span>
              <span className="font-display text-2xl tabular-nums">{formatVnd(itinerary.totalEstCost)}</span>
            </div>
          )}
        </section>

        <aside className="min-w-0 lg:sticky lg:top-24">
          <DayMap
            days={days}
            focus={focus}
            onFocus={pickFromMap}
            title={itinerary.title}
            className="h-[40vh] lg:h-[calc(100dvh-8rem)]"
          />
        </aside>
      </div>
    </PageContainer>
  )
}

/** One day of a shared itinerary: its stops, notes, photos and cost. */
function DayCard({ day, index }: { day: TripDay; index: number }) {
  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <DayChip index={index} />
        <time dateTime={day.date} className="text-sm text-muted-foreground first-letter:uppercase">
          {formatLongDate(day.date)}
        </time>
      </div>
      <h3 className="mt-2 font-display text-2xl">{day.title || t('Chưa đặt tên')}</h3>

      <ol className="mt-6 space-y-4">
        {day.locations.map((location, i) => (
          <li key={location._id} className="flex gap-4">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium">
                  {location.startTime && <span className="mr-2 tabular-nums text-muted-foreground">{location.startTime}</span>}
                  {location.name || t('Điểm dừng#one')}
                </p>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {location.costUnknown ? t('Chưa có dữ liệu') : location.estCost > 0 ? formatVnd(location.estCost) : t('Miễn phí')}
                </span>
              </div>
              {location.address && <p className="text-xs text-muted-foreground">{location.address}</p>}
              {location.note && <p className="mt-1 text-sm text-muted-foreground">{location.note}</p>}
              {location.planB && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('Plan B: {name} · cách khoảng {km} km', {
                    name: location.planB.name,
                    km: location.planB.distanceKm.toLocaleString(localeTag()),
                  })}
                </p>
              )}
              {location.photoUrl && (
                <img
                  src={location.photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="mt-3 h-40 w-full max-w-sm rounded-xl object-cover"
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-right text-sm text-muted-foreground">
        {tr('Ngày này: {cost}', { cost: <span className="text-foreground">{formatVnd(dayCostOf(day))}</span> })}
      </p>
    </GlassCard>
  )
}
