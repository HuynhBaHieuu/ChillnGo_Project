import { useRef } from 'react'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { displayFontFamily, groundColor, inkColor } from '@/app/landing/home/palette'
import { CompassMark } from '@/app/landing/home/parts/CompassMark'
import { CurvedGallery } from '@/app/landing/home/parts/curvedGallery'
import { Dome } from '@/app/landing/home/parts/Dome'
import { addDome } from '@/app/landing/home/parts/domeTween'
import { cn } from '@/lib/utils'
import type { DestinationRow, MomentPhoto } from '@/services/types'

const ROW_H = 28
const formatLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
const formatLng = (lng: number) => `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`

/**
 * Gallery travel, in card widths: from 1.5 to −3.5, so five photos pass the
 * centre left to right — the direction the old photo wheel turned.
 */
const GALLERY_FROM = 1.5
const GALLERY_TO = -3.5

/** Lens radius: coordinates part around a circle this wide at the scanner. */
const lensRadius = (desktop: boolean) => (desktop ? Math.max(88, 0.046 * window.innerWidth) : 56)

/**
 * Stage D — every stop of every trip as a coordinate list, a circle reveal, and
 * a curved WebGL gallery of trip photos (parts/curvedGallery).
 *
 * The coordinate list scrolls through a fixed scanner line at mid-screen. Rows
 * are drawn twice: the base copy, and a ground-coloured copy inside a stationary wrapper
 * clipped to the scanner — the same two-layer technique as the feature band.
 *
 * Lens: each frame, a row at distance dy from the scanner pushes its latitude
 * left and longitude right by √(R² − dy²) when |dy| < R, so the coordinates
 * part around a circle centred on the compass mark. That is the shape measured
 * in the reference (±80px at the line, ±60 two rows away, ±35 three, 0 by five).
 *
 * Scroll (1 unit = 100vh; L = list travel = rows × 0.033 units):
 *   0 → L            list travels; dotted ring turns 360°; scanner fades in
 *   L−0.3 → L        scanner fades
 *   L → L+0.3        compass turns 45° and swells
 *   L+0.2 → L+1.5    paper circle opens from the mark to cover the screen (power3.in)
 *                    while the mark scales 16× through the camera
 *   L+0.9 → L+3.5    gallery fades in; five photos pass the centre
 *   L+2.6 → L+3.2    the paper darkens to the page ground
 *   L+3.1 → L+3.5    gallery fades; paper dome rises
 *
 * The gallery renders only between L+0.8 and L+3.5, and not at all under
 * reduced motion (where the stage is a static list).
 */
export function DestinationsStage({
  rows,
  photos,
}: {
  rows: DestinationRow[]
  photos: MomentPhoto[]
}) {
  const headerRef = useRef<HTMLElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  // Rebuild the gallery when the photos change, not on every refetch's new array.
  const photoKey = photos.map((p) => p.url).join('|')

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f
        const L = u(UNITS.destinationList(rows.length))
        const total = L + u(UNITS.destinationTail)
        const listPx = rows.length * ROW_H

        const revealAt = L + u(0.2)
        const revealDur = u(1.3)
        const galleryAt = L + u(0.9)
        const galleryDur = u(2.6)
        const darkenAt = L + u(2.6)
        const domeAt = L + u(3.1)

        const gallery = new CurvedGallery(q('[data-gallery]')[0], {
          items: photos.map((p) => ({ image: p.url, text: p.tripTitle })),
          bend: desktop ? 3 : 1.5,
          textColor: inkColor(),
          fontFamily: displayFontFamily(),
        })

        // Header: blurs away as it scrolls up to the pin.
        gsap.fromTo(
          headerRef.current,
          { filter: 'blur(0px)', opacity: 1 },
          {
            filter: 'blur(6px)',
            opacity: 0.3,
            ease: 'none',
            scrollTrigger: {
              trigger: headerRef.current,
              start: 'top 30%',
              end: 'top 5%',
              scrub: SCRUB,
              onUpdate: () => setNavTheme('dark'),
            },
          },
        )

        const [baseList, hiList] = q('[data-rows]')
        const baseRows = Array.from(baseList.querySelectorAll<HTMLElement>('[data-row]'))
        const hiRows = Array.from(hiList.querySelectorAll<HTMLElement>('[data-row]'))
        const pick = (list: HTMLElement[], sel: string) =>
          list.map((row) => row.querySelector<HTMLElement>(sel)!)

        const setters = {
          lat: [...pick(baseRows, '[data-lat]'), ...pick(hiRows, '[data-lat]')].map((el) =>
            gsap.quickSetter(el, 'x', 'px'),
          ),
          lng: [...pick(baseRows, '[data-lng]'), ...pick(hiRows, '[data-lng]')].map((el) =>
            gsap.quickSetter(el, 'x', 'px'),
          ),
          blur: baseRows.map((el) => gsap.quickSetter(el, 'filter')),
          opacity: baseRows.map((el) => gsap.quickSetter(el, 'opacity')),
        }
        const lastOffset = new Float32Array(rows.length).fill(-1)
        const lastBlur = new Float32Array(rows.length).fill(-1)
        const n = rows.length

        const perFrame = () => {
          // Every ground this stage passes through is light under Arcade Neon
          // Pop: the pink page, the white circle that opens over it, and the
          // paper dome that closes it. Only the hero photograph is dark, so the
          // nav no longer changes hands anywhere below it.
          setNavTheme('light')

          const time = tl.time()
          const travel = gsap.utils.clamp(0, 1, (time - galleryAt) / galleryDur)
          gallery.scrollTo(GALLERY_FROM + (GALLERY_TO - GALLERY_FROM) * travel)
          if (time > galleryAt - u(0.1) && time < domeAt + u(0.4)) gallery.play()
          else gallery.pause()

          if (time > L + u(0.2)) return // list has left; skip the per-row work

          const y = gsap.getProperty(baseList, 'y') as number
          const mid = window.innerHeight / 2
          const topFade = window.innerHeight * 0.18
          const R = lensRadius(desktop)

          for (let i = 0; i < n; i += 1) {
            const center = y + i * ROW_H + ROW_H / 2
            const dy = center - mid
            const offset = Math.abs(dy) < R ? Math.sqrt(R * R - dy * dy) : 0

            if (Math.abs(offset - lastOffset[i]) > 0.25) {
              setters.lat[i](-offset)
              setters.lat[i + n](-offset)
              setters.lng[i](offset)
              setters.lng[i + n](offset)
              lastOffset[i] = offset
            }

            const t = center < topFade ? Math.min((topFade - center) / topFade, 1) : 0
            const blur = Math.round(t * 40) / 10
            if (blur !== lastBlur[i]) {
              setters.blur[i](`blur(${blur}px)`)
              setters.opacity[i](1 - 0.6 * t)
              lastBlur[i] = blur
            }
          }
        }

        const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: perFrame })

        // Coordinate list.
        tl.fromTo(
          q('[data-rows]'),
          { y: () => window.innerHeight * 0.6 },
          { y: () => -(listPx - window.innerHeight * 0.4), duration: L },
          0,
        )
        tl.fromTo(q('[data-ring-dots]'), { rotation: 0 }, { rotation: 360, duration: L }, 0)
        // The scanner only appears once the stage has pinned and rows are near it.
        tl.fromTo(q('[data-scanner]'), { opacity: 0 }, { opacity: 1, duration: u(0.1) }, 0)
        tl.to(q('[data-scanner]'), { opacity: 0, duration: u(0.3) }, L - u(0.3))

        // Compass turns, then the circle opens from it.
        tl.to(q('[data-ring-dots]'), { rotation: '+=90', ease: 'power1.inOut', duration: u(0.3) }, L)
        tl.to(q('[data-mark]'), { rotation: 45, scale: 1.3, ease: 'power1.inOut', duration: u(0.3) }, L)
        tl.set(q('[data-crosshair]'), { opacity: 0 }, revealAt)
        tl.set(q('[data-reveal-mark]'), { opacity: 1 }, revealAt)
        // `set` then `to`, not `fromTo`: a fromTo would stamp the 26px disc
        // onto the page the moment the timeline is built, and put it back
        // whenever you scroll up past this point.
        tl.set(q('[data-reveal]'), { clipPath: 'circle(26px at 50% 50%)' }, revealAt)
        tl.to(
          q('[data-reveal]'),
          {
            clipPath: () =>
              `circle(${Math.hypot(window.innerWidth, window.innerHeight) / 2 + 40}px at 50% 50%)`,
            ease: 'power3.in',
            duration: revealDur,
          },
          revealAt,
        )
        tl.fromTo(
          q('[data-reveal-mark]'),
          { rotation: 45, scale: 1.3 },
          { scale: 16, ease: 'power3.in', duration: revealDur },
          revealAt,
        )
        tl.to(q('[data-reveal-mark]'), { opacity: 0, duration: revealDur * 0.15 }, revealAt + revealDur * 0.85)

        // Gallery. Its travel is set per frame in perFrame.
        tl.fromTo(q('[data-gallery]'), { opacity: 0 }, { opacity: 1, duration: u(0.6) }, galleryAt)
        tl.to(q('[data-reveal]'), { backgroundColor: groundColor(), duration: u(0.6) }, darkenAt)
        tl.to(q('[data-gallery]'), { opacity: 0, duration: u(0.4) }, domeAt)
        addDome(tl, q('[data-dome]')[0], domeAt, u(0.4))
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
        })

        return () => {
          gallery.destroy()
          gsap.set([...baseRows, ...hiRows], { clearProps: 'filter,opacity' })
          gsap.set(q('[data-lat],[data-lng]'), { clearProps: 'transform' })
        }
      })
    },
    // revertOnUpdate: without it useGSAP only reverts on unmount, so a refetch
    // that changes the row count (cached data first, then fresh) would pin
    // this section a second time on top of the first pin.
    { scope: ref, dependencies: [rows.length, photoKey], revertOnUpdate: true },
  )

  return (
    <section data-reduce-theme="light" className="relative bg-background text-foreground">
      <header
        ref={headerRef}
        className="mx-auto max-w-7xl px-6 pb-[6.857rem] pt-[11.429rem] text-center motion-reduce:pb-12"
      >
        <p className="text-sm text-muted-foreground">
          Điểm đến
        </p>
        <h2 className="mt-5 font-display text-4xl tracking-tight">
          Mỗi toạ độ là một chuyến đi có thật.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          {rows.length} điểm dừng từ những hành trình trên ChillnGo — từ cao nguyên đá Hà
          Giang tới bãi cát Phú Quốc.
        </p>
      </header>

      <div ref={ref} className="relative h-screen overflow-hidden motion-reduce:h-auto">
        {/* Base rows */}
        <div
          data-rows
          className="absolute inset-x-0 top-0 text-sm text-muted-foreground motion-reduce:static"
        >
          {rows.map((row) => (
            <CoordinateRow key={row.id} row={row} tone="base" />
          ))}
        </div>

        {/* Scanner bar — ink — and the ground-coloured copy clipped to it */}
        <div
          data-scanner
          aria-hidden
          className="absolute inset-x-0 top-1/2 -mt-3.5 h-7 bg-foreground motion-reduce:hidden"
        />
        <div
          aria-hidden
          className="absolute inset-0 motion-reduce:hidden"
          style={{ clipPath: `inset(calc(50% - ${ROW_H / 2}px) 0 calc(50% - ${ROW_H / 2}px) 0)` }}
        >
          <div
            data-rows
            className="absolute inset-x-0 top-0 text-sm text-background"
          >
            {rows.map((row) => (
              <CoordinateRow key={row.id} row={row} tone="highlight" />
            ))}
          </div>
        </div>

        {/* Compass mark in a dotted ring */}
        <div
          data-crosshair
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -ml-9 -mt-9 size-[72px] motion-reduce:hidden"
        >
          <svg data-ring-dots viewBox="0 0 72 72" className="absolute inset-0">
            <circle
              cx="36"
              cy="36"
              r="35"
              fill="none"
              className="stroke-foreground/40"
              strokeDasharray="1 5"
              strokeLinecap="round"
            />
          </svg>
          <CompassMark data-mark className="absolute left-1/2 top-1/2 -ml-3 -mt-3 size-6 text-background" />
        </div>

        {/* The circle that opens into the gallery (a WebGL canvas, added in useGSAP) */}
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

        <Dome tone="paper" />
      </div>
    </section>
  )
}

function CoordinateRow({ row, tone }: { row: DestinationRow; tone: 'base' | 'highlight' }) {
  return (
    <div
      data-row
      className={cn(
        'relative flex h-7 items-center justify-between px-[2.2vw]',
        tone === 'base' && 'border-b border-white/[0.08]',
      )}
    >
      <span className="hidden w-[36%] truncate md:block">{row.name}</span>
      <span data-lat className="absolute right-[calc(50%+4px)] whitespace-nowrap">
        {formatLat(row.lat)}
      </span>
      <span data-lng className="absolute left-[calc(50%+4px)] whitespace-nowrap">
        {formatLng(row.lng)}
      </span>
      <span className="hidden w-[30%] truncate text-right md:block">{row.tripTitle}</span>
    </div>
  )
}
