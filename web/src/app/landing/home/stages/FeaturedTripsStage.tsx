import { useRef } from 'react'
import type * as React from 'react'
import { Link } from 'react-router-dom'

import { MOBILE_PIN_FACTOR, SCRUB, pinLength, vh } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { ArrowPill } from '@/app/landing/home/parts/ArrowPill'
import { REGION_LABELS, tripLengthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

/**
 * Where each card flies. `x` is the left edge in vw (desktop / mobile), `start`
 * is when it enters, in timeline units. Large cards travel the same distance
 * in less time than small ones, which reads as depth.
 */
const CARDS = [
  { x: 3, mx: 4, size: 'L', above: false, start: 0 },
  { x: 64, mx: 52, size: 'S', above: true, start: 0.35 },
  { x: 22, mx: 8, size: 'S', above: false, start: 0.77 },
  { x: 47, mx: 50, size: 'L', above: true, start: 1.05 },
  { x: 80, mx: 6, size: 'S', above: false, start: 1.4 },
  { x: 8, mx: 54, size: 'L', above: true, start: 1.82 },
  { x: 70, mx: 10, size: 'L', above: false, start: 2.17 },
  { x: 38, mx: 48, size: 'S', above: true, start: 2.52 },
] as const

const DURATION = { S: 1.58, L: 1.33 } as const
const WIDTH = {
  S: { desktop: 'max(9vw, 120px)', mobile: '34vw' },
  L: { desktop: 'max(12vw, 160px)', mobile: '42vw' },
} as const

const shortTitle = (title: string) => title.split(' — ')[0]

/**
 * Stage E — the most-saved trips flying past a pinned title.
 *
 * Scroll (1 unit = 100vh): each card travels 110vh → −40vh over 1.58 units
 * (small) or 1.33 (large), entering at its `start`; over the last 15% of its
 * trip it blurs to 6px and dims to 0.5. Cards marked `above` pass in front of
 * the title. The pin lasts until the last card is out — about 4.1 units.
 *
 * After the pin, the title blurs away over the next 60vh of scroll.
 */
export function FeaturedTripsStage({ posts }: { posts: TripPostWithAuthor[] }) {
  const ref = useRef<HTMLElement>(null)
  const cards = posts.slice(0, CARDS.length)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          onUpdate: () => setNavTheme('light'),
        })

        q('[data-card]').forEach((card, i) => {
          const layout = CARDS[i]
          const duration = u(DURATION[layout.size])
          const start = u(layout.start)

          tl.fromTo(card, { y: vh(110) }, { y: vh(-40), duration }, start)
          tl.fromTo(
            card,
            { filter: 'blur(0px)', opacity: 1 },
            { filter: 'blur(6px)', opacity: 0.5, duration: duration * 0.15, immediateRender: false },
            start + duration * 0.85,
          )
        })

        tl.fromTo(q('[data-dots]'), { rotation: 0 }, { rotation: 60, duration: tl.duration() }, 0)

        const pin = ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end: pinLength(tl.duration()),
          pin: true,
          scrub: SCRUB,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
        })

        // The title leaves once the pin lets go. Anchored to the pin's own end,
        // because a trigger on the pinned element itself would be measured from
        // before the pin spacing.
        gsap.fromTo(
          q('[data-block]'),
          { filter: 'blur(0px)', opacity: 1 },
          {
            filter: 'blur(6px)',
            opacity: 0.2,
            ease: 'none',
            scrollTrigger: {
              start: () => pin.end,
              end: () => pin.end + window.innerHeight * 0.6,
              scrub: SCRUB,
              invalidateOnRefresh: true,
            },
          },
        )
      })
    },
    { scope: ref, dependencies: [cards.length] },
  )

  return (
    <section
      ref={ref}
      data-reduce-theme="light"
      className="relative h-screen overflow-hidden bg-paper text-foreground motion-reduce:h-auto motion-reduce:py-24"
    >
      <svg
        data-dots
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute left-1/2 top-1/2 -ml-[17vw] -mt-[17vw] size-[34vw] motion-reduce:hidden"
      >
        <circle
          cx="50"
          cy="50"
          r="49.5"
          fill="none"
          className="stroke-foreground/20"
          strokeDasharray="0.4 2.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        data-block
        className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center motion-reduce:static"
      >
        <p className="text-sm text-muted-foreground">
          Hành trình nổi bật
        </p>
        <h2 className="mt-5 font-display text-4xl tracking-tight">
          Được lưu nhiều nhất
        </h2>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          Những lịch trình cộng đồng tin dùng. Mở ra xem từng ngày, rồi clone về làm của bạn.
        </p>
        <div className="mt-8">
          <ArrowPill to="/discover">Xem tất cả</ArrowPill>
        </div>
      </div>

      <div className="absolute inset-0 motion-reduce:static motion-reduce:mt-16 motion-reduce:grid motion-reduce:grid-cols-2 motion-reduce:gap-6 motion-reduce:px-6 md:motion-reduce:grid-cols-4">
        {cards.map((post, i) => {
          const layout = CARDS[i]
          return (
            <Link
              key={post._id}
              data-card
              to={`/posts/${post._id}`}
              className={cn(
                'group absolute top-0 left-[var(--x-m)] block w-[var(--w-m)] md:left-[var(--x-d)] md:w-[var(--w-d)] motion-reduce:static motion-reduce:w-auto',
                layout.above ? 'z-20' : 'z-0',
              )}
              style={
                {
                  '--x-d': `${layout.x}vw`,
                  '--x-m': `${layout.mx}vw`,
                  '--w-d': WIDTH[layout.size].desktop,
                  '--w-m': WIDTH[layout.size].mobile,
                } as React.CSSProperties
              }
            >
              <div className="aspect-[5/7] overflow-hidden bg-background/10">
                <img
                  src={post.coverUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {REGION_LABELS[post.region]} · {tripLengthLabel(post.days.length)}
              </p>
              <p className="mt-1 line-clamp-2 font-display text-[1rem]">
                {shortTitle(post.title)}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
