import { Fragment, useMemo, useRef } from 'react'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { displayFontFamily, inkColor } from '@/app/landing/home/palette'
import { CompassMark } from '@/app/landing/home/parts/CompassMark'
import { CurvedGallery } from '@/app/landing/home/parts/curvedGallery'
import { slideInWords } from '@/app/landing/home/parts/slideInWords'
import type { DestinationRow, MomentPhoto } from '@/services/types'

const formatLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
const formatLng = (lng: number) => `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`

/**
 * The trip's place, for the big outlined labels: everything before the length
 * ("Hà Giang Loop 4N3Đ" → "Hà Giang Loop", "Quy Nhơn – Phú Yên 4N3Đ bằng ô tô" → "Quy Nhơn – Phú Yên").
 */
const tripPlace = (title: string) => title.replace(/\s*\d+N\d+Đ.*$/iu, '')

/** Enough of the route to feel like a journey without turning the pan into a chore. */
const MAX_TRIPS = 4
const STOPS_PER_TRIP = 2

/** Scroll per pixel of pan: under 1, so the route moves a little faster than the page. */
const PAN_RATE = 0.75

/**
 * Gallery travel, in card widths: from 1.5 to −3.5, so five photos pass the
 * centre left to right.
 */
const GALLERY_FROM = 1.5
const GALLERY_TO = -3.5

interface RouteTrip {
  title: string
  stops: DestinationRow[]
}

/**
 * Trips ordered north to south by their mean latitude, a few stops each. When
 * there are more trips than fit, keep the northernmost, the southernmost and
 * evenly spaced ones between, so the route still spans the whole country.
 */
function routeNorthToSouth(rows: DestinationRow[]): RouteTrip[] {
  const trips = new Map<string, DestinationRow[]>()
  for (const row of rows) {
    const stops = trips.get(row.tripTitle) ?? []
    stops.push(row)
    trips.set(row.tripTitle, stops)
  }
  const meanLat = (stops: DestinationRow[]) => stops.reduce((sum, s) => sum + s.lat, 0) / stops.length
  const ordered = [...trips.entries()].sort(([, a], [, b]) => meanLat(b) - meanLat(a))
  const picked =
    ordered.length <= MAX_TRIPS
      ? ordered
      : Array.from({ length: MAX_TRIPS }, (_, i) => ordered[Math.round((i * (ordered.length - 1)) / (MAX_TRIPS - 1))])
  return picked.map(([title, stops]) => ({ title, stops: stops.slice(0, STOPS_PER_TRIP) }))
}

/**
 * Stage D — the route, north to south, then the curved WebGL gallery of trip
 * photos (parts/curvedGallery). One pin (the page's second and last).
 *
 * Scroll (1 unit = 100vh; P = the track's overflow in viewport heights × PAN_RATE):
 *   0 → P          the stops pan sideways; each brightens and settles as it
 *                  enters; the latitude readout eases to the stop crossing the
 *                  middle; the progress rail fills from first place to last
 *   P−0.1 → P+0.1  the compass mark appears and turns
 *   P+0.1 → P+1.2  a circle opens from the mark to cover the screen while the
 *                  mark scales through the camera
 *   P+0.6 → P+2.2  the gallery fades in and five photos pass the centre
 *   P+2.2 → P+2.6  the gallery leaves
 *
 * The pan tween is linear (ease 'none') so scroll and position stay proportional.
 * Per-stop effects are computed per frame from cached offsets: offsets are
 * measured on refresh, never mid-scroll, so no frame reads layout.
 */
export function DestinationsStage({ rows, photos }: { rows: DestinationRow[]; photos: MomentPhoto[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const route = useMemo(() => routeNorthToSouth(rows), [rows])
  // Rebuild when what is shown changes, not on every refetch's new array.
  const routeKey = route.map((trip) => trip.stops.map((s) => s.id).join(',')).join('|')
  const photoKey = photos.map((p) => p.url).join('|')

  const firstStop = route[0]?.stops[0]
  const firstPlace = route[0] ? tripPlace(route[0].title) : ''
  const lastPlace = route.length > 0 ? tripPlace(route[route.length - 1].title) : ''

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f

        slideInWords(q('[data-heading]')[0])

        const track = q<HTMLElement>('[data-track]')[0]
        const travel = () => Math.max(0, track.scrollWidth - window.innerWidth)
        const pan = Math.max(1, (travel() * PAN_RATE) / window.innerHeight)
        const revealAt = pan + u(0.1)
        const revealDur = u(1.1)
        const galleryAt = pan + u(0.6)
        const galleryDur = u(1.6)
        const total = pan + u(UNITS.destinationTail)

        const gallery = new CurvedGallery(q('[data-gallery]')[0], {
          items: photos.map((p) => ({ image: p.url, text: p.tripTitle })),
          bend: desktop ? 3 : 1.5,
          textColor: inkColor(),
          fontFamily: displayFontFamily(),
        })

        const stops = q<HTMLElement>('[data-stop]')
        const setOpacity = stops.map((el) => gsap.quickSetter(el, 'opacity'))
        const setY = stops.map((el) => gsap.quickSetter(el, 'y', 'px'))
        let boxes: { left: number; width: number }[] = []
        const measure = () => {
          boxes = stops.map((el) => ({ left: el.offsetLeft, width: el.offsetWidth }))
        }
        measure()

        const latEl = q('[data-lat-read]')[0]
        const latitude = { value: firstStop?.lat ?? 0 }
        let current = -1
        const showLatitude = (i: number) => {
          const lat = Number(stops[i].dataset.lat)
          if (Number.isNaN(lat)) return
          gsap.to(latitude, {
            value: lat,
            duration: 0.9,
            ease: 'expo.out',
            overwrite: true,
            onUpdate: () => {
              latEl.textContent = `${latitude.value.toFixed(2)}°`
            },
          })
        }

        const perFrame = () => {
          const time = tl.time()
          const travelled = gsap.utils.clamp(0, 1, (time - galleryAt) / galleryDur)
          gallery.scrollTo(GALLERY_FROM + (GALLERY_TO - GALLERY_FROM) * travelled)
          if (time > galleryAt - u(0.1) && time < total) gallery.play()
          else gallery.pause()

          if (time > pan + u(0.3)) return // the route has left; skip the per-stop work

          const x = gsap.getProperty(track, 'x') as number
          const width = window.innerWidth
          const mid = width / 2
          boxes.forEach((box, i) => {
            const left = box.left + x
            // 0 while the stop is past 90% of the screen, 1 once it reaches 55%.
            const t = gsap.utils.clamp(0, 1, (width * 0.9 - left) / (width * 0.35))
            setOpacity[i](0.15 + 0.85 * t)
            setY[i](36 * (1 - t))
            if (i !== current && left <= mid && left + box.width >= mid && stops[i].dataset.lat) {
              current = i
              showLatitude(i)
            }
          })
        }

        const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: perFrame })
        const mark = q('[data-reveal-mark]')
        const reveal = q('[data-reveal]')

        tl.to(track, { x: () => -travel(), duration: pan }, 0)
        tl.fromTo(q('[data-progress]'), { scaleX: 0 }, { scaleX: 1, duration: pan }, 0)
        tl.fromTo(mark, { autoAlpha: 0, scale: 0.6, rotation: 0 }, { autoAlpha: 1, scale: 1.3, rotation: 45, ease: 'power2.out', duration: u(0.2) }, pan - u(0.1))
        tl.to(q('[data-pan]'), { autoAlpha: 0, duration: u(0.3) }, revealAt + u(0.1))
        // `set` then `to`, not `fromTo`: a fromTo would stamp the small disc
        // onto the page the moment the timeline is built.
        tl.set(reveal, { clipPath: 'circle(26px at 50% 50%)' }, revealAt)
        tl.to(
          reveal,
          {
            clipPath: () => `circle(${Math.hypot(window.innerWidth, window.innerHeight) / 2 + 40}px at 50% 50%)`,
            ease: 'power3.in',
            duration: revealDur,
          },
          revealAt,
        )
        tl.to(mark, { scale: 16, ease: 'power3.in', duration: revealDur }, revealAt)
        tl.to(mark, { autoAlpha: 0, duration: revealDur * 0.15 }, revealAt + revealDur * 0.85)
        tl.fromTo(q('[data-gallery]'), { opacity: 0 }, { opacity: 1, duration: u(0.5) }, galleryAt)
        tl.to(q('[data-gallery]'), { opacity: 0, duration: u(0.4) }, galleryAt + galleryDur)
        tl.set({}, {}, total)

        ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end: pinLength(total),
          pin: true,
          scrub: SCRUB,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
          onRefresh: measure,
        })

        return () => {
          gallery.destroy()
          gsap.set(stops, { clearProps: 'opacity,transform' })
        }
      })
    },
    // revertOnUpdate: without it useGSAP only reverts on unmount, so a refetch
    // that changes the route would pin this section a second time.
    { scope: ref, dependencies: [routeKey, photoKey], revertOnUpdate: true },
  )

  return (
    <section className="relative bg-background text-foreground">
      <div ref={ref} className="relative h-screen min-h-[600px] overflow-hidden motion-reduce:h-auto motion-reduce:min-h-0">
        <div
          data-pan
          className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-[4vh] pb-28 pt-[14vh] md:pb-[7vh] motion-reduce:h-auto motion-reduce:py-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-6 px-6 md:px-14">
            <div>
              <h2
                data-heading
                className="max-w-[15ch] font-display text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]"
              >
                Mỗi toạ độ là một chuyến đi có thật.
              </h2>
              <p className="mt-3.5 max-w-[38ch] text-muted-foreground">
                {rows.length} điểm dừng từ những hành trình trên ChillnGo, từ {firstPlace} tới {lastPlace}.
              </p>
            </div>
            {firstStop && (
              <div aria-hidden className="md:text-right motion-reduce:hidden">
                <b
                  data-lat-read
                  className="block font-display text-[clamp(2.6rem,6vw,5.2rem)] font-bold leading-none tracking-[-0.04em]"
                >
                  {firstStop.lat.toFixed(2)}°
                </b>
                <span className="text-sm text-muted-foreground">vĩ độ Bắc đang đi qua</span>
              </div>
            )}
          </div>

          <div
            data-track
            className="flex w-max items-stretch gap-[clamp(28px,4vw,64px)] self-center justify-self-start pl-[calc(1.5rem+6vw)] pr-6 will-change-transform md:pl-[calc(3.5rem+6vw)] md:pr-14 motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:px-6"
          >
            {route.map((trip) => (
              <Fragment key={trip.title}>
                <div data-stop className="pr-[1vw]">
                  <p className="whitespace-nowrap font-display text-[clamp(2.2rem,4.5vw,4rem)] font-extrabold leading-none tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)]">
                    {tripPlace(trip.title)}
                  </p>
                </div>
                {trip.stops.map((stop) => (
                  <article
                    key={stop.id}
                    data-stop
                    data-lat={stop.lat}
                    className="relative grid w-[clamp(230px,24vw,340px)] content-start gap-2.5 pt-[26px]"
                  >
                    <span aria-hidden className="absolute left-0 top-0 size-[11px] rounded-full border border-primary bg-background" />
                    <span aria-hidden className="absolute left-[18px] right-[calc(-1*clamp(28px,4vw,64px))] top-[5px] h-px bg-border" />
                    <span className="font-mono text-[13px] text-primary">
                      {formatLat(stop.lat)} · {formatLng(stop.lng)}
                    </span>
                    <h3 className="font-display text-[clamp(1.35rem,2.2vw,2rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
                      {stop.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{trip.title}</p>
                  </article>
                ))}
              </Fragment>
            ))}
          </div>

          <div
            aria-hidden
            className="mx-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 font-mono text-xs text-muted-foreground md:mx-14 motion-reduce:hidden"
          >
            <span>{firstPlace}</span>
            <span className="h-px bg-border">
              <span data-progress className="block h-px origin-left scale-x-0 bg-primary" />
            </span>
            <span>{lastPlace}</span>
          </div>
        </div>

        {/* The circle that opens into the gallery (a WebGL canvas, added in useGSAP). */}
        <div
          data-reveal
          className="absolute inset-0 bg-paper motion-reduce:hidden"
          style={{ clipPath: 'circle(0px at 50% 50%)' }}
        >
          <div data-gallery className="absolute inset-0 opacity-0" />
        </div>
        <CompassMark
          data-reveal-mark
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -ml-3 -mt-3 size-6 text-foreground opacity-0 motion-reduce:hidden"
        />
      </div>
    </section>
  )
}
