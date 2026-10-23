import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { ArrowPill } from '@/app/landing/home/parts/ArrowPill'
import { slideInWords } from '@/app/landing/home/parts/slideInWords'
import { TiltCard } from '@/components/TiltCard'
import { t } from '@/i18n'
import { REGION_LABELS, tripLengthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

const shortTitle = (title: string) => title.split(' — ')[0]

/**
 * Where each card sits in the off-beat grid (desktop): a tall lead card, two
 * beside it (the second dropped a little), and a wide one under those.
 */
const SLOTS = [
  { cell: 'col-span-2 md:col-span-1 md:row-span-2', frame: 'min-h-[300px] md:h-full md:min-h-[420px]' },
  { cell: '', frame: 'aspect-[4/5]' },
  { cell: 'md:mt-[72px]', frame: 'aspect-[4/5]' },
  { cell: 'col-span-2', frame: 'aspect-[16/8]' },
] as const

/**
 * Stage E — the most-saved trips, in flow (no pin).
 *
 * The heading slides in with the scroll. Cards arrive together as a batch
 * when they reach the screen (and drop back if you scroll above them), then
 * tilt toward the cursor (TiltCard). Covers keep their own colours, dimmed a
 * little at rest and lifted on hover.
 */
export function FeaturedTripsStage({ posts }: { posts: TripPostWithAuthor[] }) {
  const ref = useRef<HTMLElement>(null)
  const cards = posts.slice(0, SLOTS.length)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        slideInWords(q('[data-heading]')[0])

        const cells = q('[data-cell]')
        const hidden = { autoAlpha: 0, y: 70, rotationX: -12, transformPerspective: 1100 }
        gsap.set(cells, hidden)
        ScrollTrigger.batch(cells, {
          start: 'top 88%',
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, overwrite: true }),
          onLeaveBack: (batch) => gsap.to(batch, { ...hidden, duration: 0.5, ease: 'power2.in', overwrite: true }),
        })
      })
    },
    // revertOnUpdate: a new card count must rebuild the batch, not add a second one.
    { scope: ref, dependencies: [cards.length], revertOnUpdate: true },
  )

  return (
    <section ref={ref} className="relative mx-auto max-w-7xl bg-background px-6 py-[18vh] text-foreground md:px-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2
          data-heading
          className="max-w-[14ch] font-display text-[clamp(2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.035em]"
        >
          {t('Được lưu nhiều nhất')}
        </h2>
        <ArrowPill to="/discover">{t('Xem tất cả')}</ArrowPill>
      </div>

      <div className="mt-[8vh] grid grid-cols-2 gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {cards.map((post, i) => (
          <div key={post._id} data-cell className={cn('self-start', SLOTS[i].cell, i === 0 && 'md:self-stretch')}>
            <TiltCard rotateAmplitude={6} scaleOnHover={1.02} className="h-full">
              <Link to={`/posts/${post._id}`} className="group grid h-full grid-rows-[1fr_auto_auto] gap-2.5">
                <div className={cn('relative overflow-hidden rounded-2xl', SLOTS[i].frame)}>
                  <img
                    src={post.coverUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover brightness-[0.8] contrast-[1.06] transition-[filter,transform] duration-700 group-hover:scale-[1.03] group-hover:brightness-100"
                  />
                  <span aria-hidden className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10 transition-shadow duration-500 group-hover:ring-primary/70" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {REGION_LABELS[post.region]} · {tripLengthLabel(post.days.length)}
                </p>
                <p className="font-display text-lg font-semibold leading-snug tracking-[-0.02em]">{shortTitle(post.title)}</p>
              </Link>
            </TiltCard>
          </div>
        ))}
      </div>
    </section>
  )
}
