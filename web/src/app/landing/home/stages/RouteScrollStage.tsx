import { ArrowRight } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'

import { MEDIA, ScrollTrigger, SplitText, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { localeTag, t } from '@/i18n'
import { landingPhoto, themeFromText, travelPhoto } from '@/lib/photos'
import type { DestinationRow, LandingStats } from '@/services/types'

const formatNumber = (value: number) => new Intl.NumberFormat(localeTag()).format(value)
const formatLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
const formatLng = (lng: number) => `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`

/** "Hà Giang Loop 4N3Đ" → "Hà Giang Loop": the place, without the trip length. */
const tripPlace = (title: string) => title.replace(/\s*\d+N\d+Đ.*$/iu, '')

const MAX_STOPS = 3
const PANEL_PHOTO = landingPhoto('haLong', 2000, 1250)
const PANEL_PHOTO_INNER = landingPhoto('beach', 2000, 1250)
const FINAL_PHOTO = landingPhoto('saPa', 2400, 1500)

/** Share of the pinned timeline spent opening the first panel's window, before the slide. */
const REVEAL = 0.15

/**
 * One stop per trip, trips ordered north to south by mean latitude, spread
 * evenly so the cards span the country. Also returns the route's two ends.
 */
function pickStops(rows: DestinationRow[]) {
  const trips = new Map<string, DestinationRow[]>()
  for (const row of rows) trips.set(row.tripTitle, [...(trips.get(row.tripTitle) ?? []), row])
  const meanLat = (stops: DestinationRow[]) => stops.reduce((sum, s) => sum + s.lat, 0) / stops.length
  const ordered = [...trips.values()].sort((a, b) => meanLat(b) - meanLat(a))
  const picked =
    ordered.length <= MAX_STOPS
      ? ordered
      : Array.from({ length: MAX_STOPS }, (_, i) => ordered[Math.round((i * (ordered.length - 1)) / (MAX_STOPS - 1))])
  const ends = ordered.length ? { north: ordered[0][0], south: ordered[ordered.length - 1].at(-1)! } : null
  return { stops: picked.map((stops) => stops[0]), ends }
}

/**
 * The route — a pinned sideways scroll, then the route's two ends as one giant
 * title over the photograph it leaves behind.
 *
 * A sticky photo sits behind everything: the panels cover it until the last
 * one, which is transparent, and the title section after the pin is set over
 * it in soft-light. No z-index on any of these layers, so the title's blend
 * reaches the photo (a z-index would isolate it).
 *
 * Pinned timeline (scrubbed):
 *   0 → REVEAL   the first panel's inner photo opens from a window to full bleed
 *   REVEAL → 1   the track slides left: stop cards, then the quote over the photo
 * The title's letters then rise and fade in with the scroll; last, an arch of
 * the dark ground rises over the photo (flattening as it fills the frame) while
 * the title shrinks away, handing over to the stage below.
 */
export function RouteScrollStage({ rows, stats }: { rows: DestinationRow[]; stats: LandingStats }) {
  const ref = useRef<HTMLDivElement>(null)
  const { stops, ends } = useMemo(() => pickStops(rows), [rows])

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()
      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        const pin = q('[data-route-pin]')[0]
        const track = q<HTMLElement>('[data-track]')[0]
        const distance = () => track.scrollWidth - window.innerWidth

        const tl = gsap.timeline({ defaults: { ease: 'none' } })
        tl.fromTo(
          q('[data-window]'),
          { clipPath: 'inset(28% 34% 28% 34% round 0.375em)' },
          { clipPath: 'inset(0% 0% 0% 0% round 0em)', ease: 'power2.inOut', duration: REVEAL },
        )
        tl.fromTo(q('[data-window] img'), { scale: 1.25 }, { scale: 1, duration: REVEAL }, 0)
        tl.to(track, { x: () => -distance(), duration: 1 - REVEAL })

        ScrollTrigger.create({
          trigger: pin,
          start: 'top top',
          end: () => `+=${distance() / (1 - REVEAL)}`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
        })

        const title = q('[data-route-title] h2')[0]
        const chars = SplitText.create(title.querySelectorAll('span'), { type: 'chars' }).chars
        gsap.from(chars, {
          yPercent: 30,
          autoAlpha: 0,
          ease: 'power2.out',
          stagger: 0.04,
          scrollTrigger: { trigger: title, start: 'top 95%', end: 'top 35%', scrub: true },
        })

        // Curtain: the dark ground rises in flow with an arched top edge (an
        // ellipse whose apex is the element's top), widened until the edge is
        // flat by the time it reaches the top of the screen.
        const curtain = q('[data-curtain]')[0]
        gsap.fromTo(
          curtain,
          { clipPath: 'ellipse(60% 100% at 50% 100%)' },
          { clipPath: 'ellipse(200% 100% at 50% 100%)', ease: 'power1.in', scrollTrigger: { trigger: curtain, start: 'top bottom', end: 'top top', scrub: true } },
        )
        gsap.to(title, {
          scale: 0.85,
          autoAlpha: 0,
          ease: 'power1.in',
          scrollTrigger: { trigger: curtain, start: 'top 75%', end: 'top 15%', scrub: true },
        })
      })
    },
    { scope: ref, dependencies: [stops], revertOnUpdate: true },
  )

  return (
    <div ref={ref} className="relative">
      {/* The photo every layer below is set over; it holds still as they pass. */}
      <div aria-hidden className="absolute inset-0">
        <div className="sticky top-0 h-svh overflow-hidden">
          <img src={FINAL_PHOTO} alt="" loading="lazy" className="size-full object-cover" />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      </div>

      <section data-route-pin className="relative h-svh overflow-hidden motion-reduce:overflow-x-auto">
        <div data-track className="flex h-full w-max">
          {/* Panel 1 — a window of one photo opening over another. */}
          <div className="relative h-full w-screen shrink-0 overflow-hidden text-white">
            <img src={PANEL_PHOTO} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            <div data-window className="absolute inset-0 overflow-hidden">
              <img src={PANEL_PHOTO_INNER} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-0 flex items-center justify-center">
                <h2 className="font-display text-[3.75em] font-bold tracking-[-0.035em] leading-none md:text-[8.75em]">{t('Điểm dừng')}</h2>
              </div>
              <div className="absolute inset-x-0 bottom-[12%] mx-auto grid w-[calc(100%-1.5em)] grid-cols-8 md:grid-cols-12">
                <div className="col-span-6 col-start-2 flex flex-col gap-[0.35em] md:col-span-2 md:col-start-9">
                  <p className="font-mono text-[0.75em] uppercase leading-[1.2] tracking-[0.12em] text-primary">{t('Toạ độ có thật')}</p>
                  <p className="font-body text-[0.875em] font-medium leading-[1.5]">
                    {ends
                      ? t('{n} điểm dừng được ghim toạ độ bởi chính người đã đến, từ {from} tới {to}. Cuộn để đi một vòng.', {
                          n: formatNumber(stats.stopCount),
                          from: tripPlace(ends.north.tripTitle),
                          to: tripPlace(ends.south.tripTitle),
                        })
                      : t('{n} điểm dừng được ghim toạ độ bởi chính người đã đến. Cuộn để đi một vòng.', {
                          n: formatNumber(stats.stopCount),
                        })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Panels 2–4 — one stop each. */}
          {stops.map((stop) => (
            <div
              key={stop.id}
              className="flex h-full w-screen shrink-0 items-center bg-background px-[1.25em] md:w-[calc(50vw+12.5em)] md:pl-0 md:pr-[12.5em]"
            >
              <Link
                to={`/posts/${stop.postId}`}
                className="group grid aspect-[4/5] w-full rounded-[0.375em] border border-border bg-white/[0.03] p-[1.25em] md:aspect-[4/3] md:w-[50vw]"
              >
                <div className="relative flex size-full flex-col overflow-hidden rounded-[0.125em] px-[1.25em] py-[2.5em] md:p-[2.5em]">
                  <img
                    src={travelPhoto(stop.name, { w: 1400, h: 1050, theme: themeFromText(stop.name) })}
                    alt={stop.name}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 transition-colors duration-300 ease-[cubic-bezier(.5,1,.89,1)] group-hover:bg-black/35" />
                  <div className="relative flex h-full flex-col items-center gap-[1.25em] text-center text-white md:gap-[2em]">
                    <h3 className="font-display text-[1.625em] font-bold tracking-[-0.035em] leading-none md:text-[2.625em]">{stop.name}</h3>
                    <p className="mx-auto max-w-full font-body text-[0.875em] font-medium leading-[1.4] md:max-w-[80%]">
                      {t('Một điểm dừng trong {trip}. Mở hành trình để xem giờ giấc, chi phí và ghi chú của người đã đi.', { trip: stop.tripTitle })}
                    </p>
                    <span className="inline-flex items-center gap-[0.5em] border-b border-white/40 pb-[0.2em] font-body text-[0.875em] font-medium md:hidden">
                      {t('Xem hành trình')} <ArrowRight aria-hidden className="size-[1em]" />
                    </span>
                    <p className="mt-auto font-mono text-[0.75em] leading-[1.4] text-primary">
                      [ {formatLat(stop.lat)}, {formatLng(stop.lng)} ]
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}

          {/* Last panel — transparent, so the quote sits on the photo behind. */}
          <div className="flex h-full w-screen shrink-0 items-center justify-center px-[1.25em] text-white">
            <figure className="flex max-w-[30em] flex-col items-center gap-[0.35em] text-center">
              <span aria-hidden className="mb-[0.4em] h-[0.5em] font-display text-[3.25em] leading-none">
                “
              </span>
              <blockquote className="font-display text-[1.5em] font-medium leading-[1.2] md:text-[2em]">
                {t('Lên kế hoạch mất ba tuần. Sao chép một chuyến đi có thật chỉ mất một chạm.')}
              </blockquote>
              <p className="font-body text-[0.875em] font-medium">-</p>
              <figcaption className="font-mono text-[0.75em] uppercase tracking-[0.12em] text-primary">{t('Cộng đồng ChillnGo')}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* The route's two ends, set in soft-light over the photo. */}
      <section data-route-title className="relative flex min-h-svh flex-col justify-center gap-[2em] pb-[6em] pt-[8.75em]">
        <h2 className="whitespace-nowrap text-center font-condensed text-[8em] font-normal uppercase leading-[0.9] text-white mix-blend-soft-light md:text-[17em]">
          <span className="hidden pt-[0.12em] md:inline-block">{t('Bắc — Nam')}</span>
          <span className="inline-block pt-[0.12em] md:hidden">
            {t('Bắc — Nam').split(' — ')[0]}
            <br />
            {t('Bắc — Nam').split(' — ')[1]}
          </span>
        </h2>
        {ends && (
          <div className="mx-auto flex w-[calc(100%-1.5em)] justify-between px-[0.75em] font-mono text-[0.75em] leading-[1.5] text-white/80">
            <p>
              {formatLat(ends.north.lat)} {formatLng(ends.north.lng)}
              <br />
              {tripPlace(ends.north.tripTitle)}
            </p>
            <p className="text-right">
              {formatLat(ends.south.lat)} {formatLng(ends.south.lng)}
              <br />
              {tripPlace(ends.south.tripTitle)}
            </p>
          </div>
        )}
      </section>

      {/* Hand-over to the dark stages: clipped to a rising arch on scroll, a
          plain block of the ground with reduced motion. The negative margin
          lets the next stage ride up over its lower half (same colour), so its
          heading arrives as the arch flattens instead of after a blank screen. */}
      <div data-curtain aria-hidden className="relative -mb-[45svh] h-svh bg-background" />
    </div>
  )
}
