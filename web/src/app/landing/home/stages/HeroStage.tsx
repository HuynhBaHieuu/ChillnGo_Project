import { Play } from 'lucide-react'
import { useRef, useState } from 'react'

import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { FILMS, HERO_VIDEOS } from '@/app/landing/home/videos'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Hero — full-screen footage and a giant condensed title; on scroll the
 * footage closes into a rounded card and fades into the statement below.
 *
 * The section is 200svh with a sticky 100svh frame, so the footage holds still
 * (no GSAP pin) while, over that one screen of scroll:
 *   copy + title    rise 60svh, faster than the page
 *   footage         slow push-in, clipped into a centred rounded card,
 *                   then faded out so the frame is solid background
 * The load-in fades the inner `[data-hero-reveal]` elements; the scroll moves
 * their parent, so the two never share a transform.
 */
export function HeroStage() {
  const ref = useRef<HTMLElement>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [film, setFilm] = useState<number | null>(null)
  const hero = HERO_VIDEOS[heroIndex]

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()
      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        gsap.from(q('[data-hero-reveal]'), { autoAlpha: 0, y: 40, duration: 1.6, ease: 'expo.out', stagger: 0.12, delay: 0.2 })

        const h = () => window.innerHeight
        const tl = gsap.timeline({
          defaults: { ease: 'none', duration: 1 },
          scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
        })

        tl.to(q('[data-hero-content]'), { y: () => -0.6 * h() }, 0)
          .to(q('[data-hero-video]'), { scale: 1.12 }, 0)
          .fromTo(
            q('[data-hero-clip]'),
            { clipPath: 'inset(0% 0% 0% 0% round 0em)' },
            { clipPath: 'inset(28% 32% 28% 32% round 1.5em)', duration: 0.75, ease: 'power2.inOut' },
            0,
          )
          .to(q('[data-hero-clip]'), { autoAlpha: 0, duration: 0.25 }, 0.75)
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} className="relative h-[200svh] bg-background text-white motion-reduce:h-svh">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div data-hero-clip className="absolute inset-0">
          <div data-hero-video className="absolute inset-0 will-change-transform">
            {/* One video loops; several play in turn (see videos.ts). */}
            <video
              src={hero.src}
              poster={hero.poster}
              autoPlay
              loop={HERO_VIDEOS.length === 1}
              onEnded={() => setHeroIndex((i) => (i + 1) % HERO_VIDEOS.length)}
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        </div>

        <div data-hero-content className="absolute inset-0 z-[2] grid grid-rows-2 will-change-transform">
          {/* Row 1 — tagline left, film button right (stacked and centred on phones). */}
          <div className="mx-auto grid w-[calc(100%-1.5em)] grid-cols-12 content-end items-center gap-x-[0.75em] gap-y-[2.5em] pb-[2em] md:content-center md:pb-0">
            <div className="col-span-12 px-[2.5em] text-center md:col-span-3 md:pl-[calc(3.75em-12px)] md:pr-0 md:text-left">
              <p data-hero-reveal className="text-balance font-display text-[1.25em] font-medium leading-[1.2] md:text-[1.125em]">
                {t('Những chuyến đi có thật, kể lại bởi chính người đã đi')}
              </p>
            </div>
            <div className="col-span-12 px-[2.5em] md:col-span-3 md:col-start-10 md:px-0">
              <div data-hero-reveal>
                <FilmButton onClick={() => setFilm(0)} />
              </div>
            </div>
          </div>

          {/* Row 2 — the title, sat on the bottom edge. */}
          {/* Phones: clear the app's bottom tab bar. */}
          <div className="mx-auto flex w-[calc(100%-1.5em)] items-end justify-center pb-[7em] md:pb-[1.5em]">
            <h1
              data-hero-reveal
              // pb: room for the dot under "Ệ", which hangs below the line box.
              className="whitespace-nowrap pb-[0.1em] text-center font-condensed text-[5em] font-normal uppercase leading-none md:text-[16em]"
            >
              {t('Việt Nam')}
            </h1>
          </div>
        </div>
      </div>

      <Dialog open={film !== null} onOpenChange={(open) => !open && setFilm(null)}>
        <DialogContent className="max-w-5xl bg-black p-0">
          <DialogTitle className="sr-only">{t('Phim ChillnGo')}</DialogTitle>
          {film !== null && (
            <video key={film} src={FILMS[film].src} autoPlay controls playsInline className="aspect-video w-full rounded-2xl" />
          )}
          {FILMS.length > 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {FILMS.map((f, i) => (
                <button
                  key={f.src}
                  type="button"
                  onClick={() => setFilm(i)}
                  className={cn(
                    'rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 transition-colors hover:text-white',
                    i === film && 'border-white bg-white text-black hover:text-black',
                  )}
                >
                  {f.title}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/**
 * A hairline-bordered bar; on hover a small photo opens out of its middle
 * (clip-path inset 50% → 0) and the label pulls in onto it.
 */
function FilmButton({ onClick }: { onClick: () => void }) {
  const ease = 'transition-all duration-300 ease-[cubic-bezier(.5,1,.89,1)]'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[2.75em] w-full items-center justify-center border-y-[0.5px] border-white/20 px-[2em] py-[0.35em] hover:border-white/0 md:w-[calc(100%-3.75em+12px)] ${ease}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 aspect-[11.625/13.125] w-[60%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[0.275em] opacity-0 [clip-path:inset(50%_0%)] group-hover:opacity-100 group-hover:[clip-path:inset(0%)] ${ease}`}
      >
        <img src={FILMS[0].preview} alt="" loading="lazy" className="size-full object-cover" />
      </span>
      <span className={`relative z-[1] flex w-full items-center justify-between group-hover:w-[50%] ${ease}`}>
        <span className="font-body text-[0.875em] font-medium">{t('Xem phim')}</span>
        <Play aria-hidden className="size-[0.7em] fill-current" />
      </span>
    </button>
  )
}
