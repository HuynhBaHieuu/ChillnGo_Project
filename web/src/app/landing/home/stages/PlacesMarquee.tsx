import { useMemo, useRef } from 'react'

import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { cn } from '@/lib/utils'
import type { DestinationRow } from '@/services/types'

/** Stops per trip and in total, so every trip shows up and the band stays short. */
const PER_TRIP = 2
const MAX_PLACES = 12

function pickPlaces(rows: DestinationRow[]) {
  const seen = new Map<string, number>()
  const picked: DestinationRow[] = []
  for (const row of rows) {
    const n = seen.get(row.tripTitle) ?? 0
    if (n >= PER_TRIP) continue
    seen.set(row.tripTitle, n + 1)
    picked.push(row)
    if (picked.length === MAX_PLACES) break
  }
  return picked
}

/**
 * The page's one marquee: two bands of real stop names running in opposite
 * directions between the figures and how-it-works. Scrolling pushes them
 * faster and leans them with the momentum; scrolling up reverses them; then
 * they settle back to their idle pace. They only run while on screen.
 *
 * Decorative (every stop is listed again in the destinations stage), so it is
 * hidden from assistive tech. Reduced motion leaves the bands still.
 */
export function PlacesMarquee({ rows }: { rows: DestinationRow[] }) {
  const ref = useRef<HTMLElement>(null)
  const places = useMemo(() => pickPlaces(rows), [rows])

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        const bands = q('[data-band]')
        const loops = q('[data-track]').map((track, i) => {
          const forward = i % 2 === 0
          return gsap.fromTo(
            track,
            { xPercent: forward ? 0 : -50 },
            { xPercent: forward ? -50 : 0, duration: 45, ease: 'none', repeat: -1, paused: true },
          )
        })

        let surge: GSAPTimeline | undefined
        ScrollTrigger.create({
          trigger: ref.current,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => loops.forEach((loop) => (self.isActive ? loop.play() : loop.pause())),
          onUpdate: (self) => {
            const velocity = self.getVelocity()
            surge?.kill()
            surge = gsap
              .timeline()
              .to(loops, { timeScale: gsap.utils.clamp(1, 7, 1 + Math.abs(velocity) / 260) * self.direction, duration: 0.2, ease: 'power2.out' }, 0)
              .to(bands, { skewX: gsap.utils.clamp(-8, 8, -velocity / 320), duration: 0.2, ease: 'power2.out' }, 0)
              .to(loops, { timeScale: self.direction, duration: 1.4, ease: 'power3.out' }, 0.25)
              .to(bands, { skewX: 0, duration: 1.2, ease: 'power3.out' }, 0.25)
          },
        })

        return () => surge?.kill()
      })
    },
    { scope: ref, dependencies: [places], revertOnUpdate: true },
  )

  if (places.length === 0) return null

  return (
    <section
      ref={ref}
      aria-hidden
      className="relative overflow-hidden border-y border-border bg-background py-[6vh] text-foreground"
    >
      {[0, 1].map((band) => (
        <div key={band} data-band className="will-change-transform">
          <div
            data-track
            className="flex w-max items-baseline whitespace-nowrap font-display text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[1.15] tracking-[-0.04em] will-change-transform"
          >
            {/* Two copies, so the loop can wrap at -50% without a seam. */}
            {[...places, ...places].map((place, i) => (
              <span key={`${place.id}-${i}`} className="flex items-baseline">
                <span
                  className={cn(
                    'pr-[0.3em]',
                    (i + band) % 2 === 1 && 'text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.4)]',
                  )}
                >
                  {place.name}
                </span>
                <span className="pr-[2.2em] font-mono text-[0.24em] font-normal tracking-normal text-primary">
                  {Math.abs(place.lat).toFixed(1)}°{place.lat >= 0 ? 'N' : 'S'}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
