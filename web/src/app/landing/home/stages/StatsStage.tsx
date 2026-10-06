import { useRef } from 'react'

import { SCRUB, vw } from '@/app/landing/home/config'
import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { slideInWords } from '@/app/landing/home/parts/slideInWords'
import { cn } from '@/lib/utils'
import type { LandingStats } from '@/services/types'

const formatNumber = new Intl.NumberFormat('vi-VN').format

/**
 * Stage B — four figures, in flow (no pin). Everything follows the scroll
 * position, so it plays forward and back with the reader:
 *
 *   heading     words slide in sideways (slideInWords)
 *   columns     glide in from the right, each from further than the last
 *   rules       draw left to right above each figure
 *   figures     count up from zero with the scroll
 *   on the way out the heading and the grid drift apart sideways
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
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        slideInWords(q('[data-heading]')[0])

        const counts = q<HTMLElement>('[data-count]')
        counts.forEach((el) => (el.textContent = '0'))

        const enter = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: { trigger: q('[data-grid]')[0], start: 'top 92%', end: 'top 40%', scrub: SCRUB },
        })
        enter
          .fromTo(q('[data-stat]'), { x: (i: number) => 160 + i * 70, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08 }, 0)
          .fromTo(q('[data-rule]'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, stagger: 0.08, ease: 'power2.inOut' }, 0.1)
        counts.forEach((el, i) => {
          const counter = { value: 0 }
          enter.to(
            counter,
            {
              value: items[i].value,
              duration: 0.6,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = formatNumber(Math.round(counter.value))
              },
            },
            0.12 + i * 0.08,
          )
        })

        gsap
          .timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { trigger: ref.current, start: 'center center', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
          })
          .to(q('[data-heading]'), { x: vw(6) }, 0)
          .to(q('[data-grid]'), { x: vw(-5) }, 0)

        return () => counts.forEach((el, i) => (el.textContent = formatNumber(items[i].value)))
      })
    },
    // react-query keeps the same object while the numbers are unchanged.
    { scope: ref, dependencies: [stats], revertOnUpdate: true },
  )

  return (
    <section
      ref={ref}
      className="relative mx-auto max-w-7xl overflow-x-clip bg-background px-6 py-[22vh] text-foreground md:px-14"
    >
      <h2
        data-heading
        className="max-w-[16ch] font-display text-[clamp(2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.035em]"
      >
        Được kể lại từ những chuyến đi thật
      </h2>

      <div data-grid className="mt-[10vh] grid grid-cols-2 gap-8 md:grid-cols-4">
        {items.map((item, i) => (
          <div key={item.label} data-stat className={cn('relative pt-[22px]', i % 2 === 1 && 'mt-16')}>
            <span data-rule aria-hidden className="absolute inset-x-0 top-0 h-px origin-left bg-border" />
            <span
              data-count
              className="block font-display text-[clamp(2.6rem,5.6vw,5rem)] font-bold leading-none tracking-[-0.04em]"
            >
              {formatNumber(item.value)}
            </span>
            <span className="mt-2.5 block text-[15px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
