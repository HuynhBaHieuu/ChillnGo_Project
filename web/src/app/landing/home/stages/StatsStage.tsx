import { useRef } from 'react'
import type * as React from 'react'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength, vh } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, SplitText, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { CharLayers } from '@/app/landing/home/parts/CharLayers'
import { Dome } from '@/app/landing/home/parts/Dome'
import { addDome } from '@/app/landing/home/parts/domeTween'
import type { LandingStats } from '@/services/types'

const formatNumber = new Intl.NumberFormat('vi-VN').format

/** Circle diameter: 11vw, never under 140px. */
const diameter = () => Math.max(0.11 * window.innerWidth, 140)

/**
 * Stage B — four stat circles, then the dome into the first light section.
 *
 * Scroll (1 unit = 100vh):
 *   0.00–0.25  first circle grows in
 *   0.15–0.55  the stacked circles slide out to their places (2×2 on phones)
 *   0.20–0.45  label lights up
 *   0.35–0.70  numbers count up from zero
 *   0.80–1.50  paper dome rises; nav turns light once it covers the top
 */
export function StatsStage({ stats }: { stats: LandingStats }) {
  const ref = useRef<HTMLElement>(null)

  const items = [
    { value: stats.tripCount, label: 'hành trình' },
    { value: stats.cloneCount, label: 'lượt clone' },
    { value: stats.bookmarkCount, label: 'lượt lưu' },
    { value: stats.stopCount, label: 'điểm dừng' },
  ]

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f
        const total = u(UNITS.stats)
        const lightFrom = u(0.8 + 0.7 * 0.85)

        const circles = q<HTMLElement>('[data-circle]')
        const counts = q<HTMLElement>('[data-count]')
        const split = SplitText.create(q('[data-chars]'), { type: 'words,chars', tag: 'span' })

        counts.forEach((el) => (el.textContent = '0'))

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          onUpdate: () => setNavTheme(tl.time() >= lightFrom ? 'light' : 'dark'),
        })

        tl.fromTo(
          circles[0],
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, ease: 'power2.out', duration: u(0.25) },
          0,
        )
        tl.fromTo(
          circles.slice(1),
          { opacity: 0 },
          { opacity: 1, stagger: u(0.05), duration: u(0.2) },
          u(0.15),
        )
        tl.fromTo(
          circles,
          { x: 0, y: 0 },
          {
            x: (i: number) =>
              desktop ? (i - 1.5) * 0.92 * diameter() : ((i % 2) - 0.5) * 1.05 * diameter(),
            y: (i: number) => (desktop ? 0 : Math.floor(i / 2) * 1.05 * diameter()),
            ease: 'power3.out',
            duration: u(0.4),
          },
          u(0.15),
        )
        tl.fromTo(
          split.chars,
          { opacity: 0, color: 'rgba(255, 255, 255, 0.55)' },
          { opacity: 1, color: '#ffffff', duration: u(0.05), stagger: { amount: u(0.2) } },
          u(0.2),
        )

        counts.forEach((el, i) => {
          const counter = { value: 0 }
          tl.to(
            counter,
            {
              value: items[i].value,
              ease: 'power1.out',
              duration: u(0.35),
              onUpdate: () => {
                el.textContent = formatNumber(Math.round(counter.value))
              },
            },
            u(0.35),
          )
        })
        tl.fromTo(
          counts,
          { color: 'rgba(255, 255, 255, 0.35)' },
          { color: '#ffffff', duration: u(0.35) },
          u(0.35),
        )

        addDome(tl, q('[data-dome]')[0], u(0.8), u(0.7))
        tl.to(q('[data-group]'), { y: vh(-6), opacity: 0, duration: u(0.3) }, u(1.1))
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
          split.revert()
          counts.forEach((el, i) => (el.textContent = formatNumber(items[i].value)))
        }
      })
    },
    { scope: ref },
  )

  return (
    <section
      ref={ref}
      data-reduce-theme="dark"
      className="relative h-screen overflow-hidden bg-background text-foreground motion-reduce:h-auto motion-reduce:py-32"
      style={{ '--d': 'max(11vw, 140px)' } as React.CSSProperties}
    >
      <div
        data-group
        className="flex h-full flex-col items-center justify-center gap-12 px-6"
      >
        <CharLayers
          text="Được kể lại từ những chuyến đi thật"
          className="text-xs font-medium uppercase tracking-[0.3em]"
        />

        <div className="relative h-[calc(var(--d)*2.1)] w-full md:h-[var(--d)] motion-reduce:flex motion-reduce:h-auto motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-4">
          {items.map((item) => (
            <div
              key={item.label}
              data-circle
              className="absolute left-1/2 top-0 ml-[calc(var(--d)*-0.5)] flex size-[var(--d)] flex-col items-center justify-center rounded-full border border-white/25 motion-reduce:static motion-reduce:ml-0"
            >
              <span
                data-count
                className="font-display text-[clamp(1.75rem,3vw,3rem)] leading-none tabular-nums"
              >
                {formatNumber(item.value)}
              </span>
              <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Dome tone="paper" />
    </section>
  )
}
