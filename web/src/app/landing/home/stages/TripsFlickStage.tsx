import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { drawScribbles } from '@/app/landing/home/parts/expedition'
import { Scribble } from '@/app/landing/home/parts/ExpeditionMarks'
import { REGION_LABELS, formatVndShort, tripLengthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

const MAX_CARDS = 5
const shortTitle = (title: string) => title.split(' — ')[0]

/** Open card takes half the row; the other four share the rest. */
const OPEN_WIDTH = '50%'
const SHUT_WIDTH = '12.5%'

/**
 * "Hành trình" — a row of trip photos where the one under the cursor opens to
 * half the row and shows its details; the rest stay narrow behind a blur.
 * Phones stack them full-width with the details always shown.
 * Then a short note from the team.
 *
 * INTERACTION MODEL: hover/focus opens a card (desktop only). Each card is
 * tweened on its own with `overwrite`, so sweeping the cursor across the row
 * retargets mid-flight: cards passed over swell a little and ease back instead
 * of snapping. Details fade in on the new card while the old one's drop out
 * fast; the blur lifts almost at once.
 */
export function TripsFlickStage({ posts }: { posts: TripPostWithAuthor[] }) {
  const ref = useRef<HTMLElement>(null)
  const trips = posts.slice(0, MAX_CARDS)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return
        drawScribbles(ref.current!)
        if (!desktop) return

        const cards = gsap.utils.toArray<HTMLElement>('[data-card]', ref.current)
        const open = (i: number) =>
          cards.forEach((card, j) => {
            const on = i === j
            gsap.to(card, { width: on ? OPEN_WIDTH : SHUT_WIDTH, duration: 0.6, ease: 'power3.out', overwrite: true })
            gsap.to(card.querySelector('[data-card-details]'), {
              autoAlpha: on ? 1 : 0,
              duration: on ? 0.6 : 0.25,
              ease: on ? 'power1.out' : 'power2.out',
              overwrite: true,
            })
            gsap.to(card.querySelector('[data-card-blur]'), { opacity: on ? 0 : 1, duration: 0.15, overwrite: true })
          })

        const listeners = cards.map((card, i) => {
          const onEnter = () => open(i)
          card.addEventListener('mouseenter', onEnter)
          card.addEventListener('focus', onEnter)
          return () => {
            card.removeEventListener('mouseenter', onEnter)
            card.removeEventListener('focus', onEnter)
          }
        })
        return () => listeners.forEach((off) => off())
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} className="bg-background text-foreground">
      <div className="flex justify-center pb-[3em] pt-[12.5em] md:pb-[6em] md:pt-[15em]">
        <div className="relative">
          <h2 className="text-center font-display text-[2em] font-bold tracking-[-0.035em] leading-none md:text-[3.75em]">Hành trình</h2>
          <Scribble className="left-1/2 top-[85%] w-[160%] max-w-[40em] -translate-x-1/2" />
        </div>
      </div>

      <div className="mx-auto flex w-[calc(100%-1.5em)] flex-col gap-[0.625em] overflow-hidden rounded-[0.25em] md:flex-row md:gap-0">
        {trips.map((post, i) => {
          // First card starts open; the tweens take over from these classes.
          const isOpen = i === 0
          return (
            <Link
              key={post._id}
              data-card
              to={`/posts/${post._id}`}
              className={cn(
                'group relative block h-[65svh] w-full shrink-0 overflow-hidden rounded-[0.25em] will-change-[width] md:h-[85svh] md:rounded-none',
                isOpen ? 'md:w-1/2' : 'md:w-[12.5%]',
              )}
            >
              {/* Wider than the card, so it is cropped, not rescaled, as the card opens. */}
              <img
                src={post.coverUrl}
                alt={post.title}
                loading="lazy"
                className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 object-cover transition-transform duration-[600ms] ease-[cubic-bezier(.4,0,.2,1)] group-hover:scale-105 md:min-w-[50vw]"
              />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/55" />
              <span
                data-card-blur
                aria-hidden
                className={cn('absolute inset-0 hidden bg-black/[0.01] backdrop-blur-[7.5px] md:block', isOpen && 'opacity-0')}
              />

              <div
                data-card-details
                className={cn(
                  'absolute inset-0 flex flex-col justify-between p-[1.25em] pb-[1.875em] text-white md:w-[30vw] md:p-[2.75em]',
                  !isOpen && 'md:invisible md:opacity-0',
                )}
              >
                <h3 className="max-w-[30ch] text-balance font-display text-[1.625em] font-bold leading-none tracking-[-0.035em] md:text-[2.625em]">
                  {shortTitle(post.title)}
                </h3>
                <div className="flex flex-col items-start gap-[1.5em]">
                  <div className="flex flex-wrap items-center gap-[1.1em] font-body text-[1em] font-semibold leading-none">
                    <span>{formatVndShort(post.totalEstCost)}</span>
                    <span aria-hidden className="h-[1em] w-px bg-white" />
                    <span>{tripLengthLabel(post.days.length)}</span>
                    <span aria-hidden className="h-[1em] w-px bg-white" />
                    <span>{REGION_LABELS[post.region]}</span>
                  </div>
                  <p className="line-clamp-3 max-w-[36ch] font-body text-[1em] font-medium leading-[1.4]">{post.summary}</p>
                  <span className="inline-flex items-center gap-[0.5em] border-b border-white/40 pb-[0.2em] font-body text-[0.875em] font-medium md:hidden">
                    Xem hành trình <ArrowRight aria-hidden className="size-[1em]" />
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Note from the team. */}
      <div className="mx-auto grid w-[calc(100%-1.5em)] grid-cols-8 py-[8em] md:grid-cols-12 md:py-[20em]">
        <figure className="relative col-span-7 col-start-2 flex flex-col items-start gap-[0.35em] md:col-span-4 md:col-start-5">
          <span aria-hidden className="h-[0.5em] font-display text-[2.25em] leading-none">
            “
          </span>
          <blockquote className="font-display text-[1.5em] font-medium leading-[1.2] indent-[16.667%] md:text-[1.375em]">
            Lịch trình hay nhất không nằm trong cẩm nang, mà nằm trong chuyến đi của ai đó vừa trở về. Chúng tôi làm ChillnGo
            để những chuyến đi ấy được kể lại đủ chi tiết, và người đi sau chỉ cần một chạm để bắt đầu.
          </blockquote>
          <p className="font-body text-[0.875em] font-medium">-</p>
          <figcaption className="relative">
            <p className="font-body text-[0.875em] font-medium leading-[1.5]">Đội ngũ ChillnGo</p>
            <p className="font-body text-[0.875em] font-medium leading-[1.5] text-muted-foreground">Những người làm ra ChillnGo</p>
            <Scribble className="-left-[20%] top-[70%] w-[160%] min-w-[10em]" />
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
