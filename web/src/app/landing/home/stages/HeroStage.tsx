import { Play } from 'lucide-react'
import { useRef, useState } from 'react'

import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { landingPhoto } from '@/lib/photos'

/*
 * Footage: Mixkit (free licence, no attribution required).
 * 39912 — a rider on an empty mountain road; 12987 — a backpacker at a viewpoint.
 */
const HERO_VIDEO = 'https://assets.mixkit.co/videos/39912/39912-720.mp4'
const FILM_VIDEO = 'https://assets.mixkit.co/videos/12987/12987-720.mp4'
const HERO_POSTER = landingPhoto('mountainRoad', 1920, 1080)
const FILM_PREVIEW = landingPhoto('riceTerraces', 600, 680)

/** Soft dark puffs along the top edge of a mist layer: [left %, top %, width vw, height vw]. */
const PUFFS = [
  [-10, 4, 46, 22],
  [18, 0, 40, 18],
  [42, 6, 48, 24],
  [68, 1, 44, 20],
  [86, 5, 40, 22],
  [5, 14, 60, 26],
  [55, 15, 60, 28],
] as const

function Mist({ layer, className }: { layer: 'back' | 'front'; className: string }) {
  return (
    <div data-mist={layer} aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 z-[3] ${className}`}>
      {PUFFS.map(([left, top, w, h], i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${w}vw`,
            height: `${h}vw`,
            background: 'radial-gradient(closest-side, hsl(var(--background)) 30%, hsl(var(--background) / 0.55) 60%, transparent)',
          }}
        />
      ))}
    </div>
  )
}

/**
 * Hero — full-screen footage, a giant condensed title, and a dark mist that
 * rises over it on scroll into the statement below.
 *
 * The section is 200svh with a sticky 100svh frame, so the footage holds still
 * (no GSAP pin) while, over that one screen of scroll:
 *   copy + title    rise 60svh, faster than the page
 *   footage         slow push-in
 *   mist (back)     drifts up two-thirds of the way
 *   mist (front)    rises until the frame is solid background
 * The load-in fades the inner `[data-hero-reveal]` elements; the scroll moves
 * their parent, so the two never share a transform.
 */
export function HeroStage() {
  const ref = useRef<HTMLElement>(null)
  const [filmOpen, setFilmOpen] = useState(false)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()
      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        gsap.from(q('[data-hero-reveal]'), { autoAlpha: 0, y: 40, duration: 1.6, ease: 'expo.out', stagger: 0.12, delay: 0.2 })

        gsap
          .timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
          })
          .to(q('[data-hero-content]'), { y: () => -0.6 * window.innerHeight }, 0)
          .to(q('[data-hero-video]'), { scale: 1.12 }, 0)
          .fromTo(q('[data-mist="back"]'), { y: () => window.innerHeight }, { y: () => 0.3 * window.innerHeight }, 0)
          .fromTo(q('[data-mist="front"]'), { y: () => window.innerHeight }, { y: () => -0.8 * window.innerHeight }, 0)
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} className="relative h-[200svh] bg-background text-white motion-reduce:h-svh">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div data-hero-video className="absolute inset-0 will-change-transform">
          <video autoPlay loop muted playsInline preload="metadata" poster={HERO_POSTER} className="size-full object-cover">
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div data-hero-content className="absolute inset-0 z-[2] grid grid-rows-2 will-change-transform">
          {/* Row 1 — tagline left, film button right (stacked and centred on phones). */}
          <div className="mx-auto grid w-[calc(100%-1.5em)] grid-cols-12 content-end items-center gap-x-[0.75em] gap-y-[2.5em] pb-[2em] md:content-center md:pb-0">
            <div className="col-span-12 px-[2.5em] text-center md:col-span-3 md:pl-[calc(3.75em-12px)] md:pr-0 md:text-left">
              <p data-hero-reveal className="text-balance font-display text-[1.25em] font-medium leading-[1.2] md:text-[1.125em]">
                Những chuyến đi có thật, kể lại bởi chính người đã đi
              </p>
            </div>
            <div className="col-span-12 px-[2.5em] md:col-span-3 md:col-start-10 md:px-0">
              <div data-hero-reveal>
                <FilmButton onClick={() => setFilmOpen(true)} />
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
              Việt Nam
            </h1>
          </div>
        </div>

        <Mist layer="back" className="h-svh bg-gradient-to-b from-transparent via-background/40 to-background/80 motion-reduce:hidden" />
        <Mist layer="front" className="h-[180svh] bg-gradient-to-b from-transparent via-background via-[30%] to-background motion-reduce:hidden" />
      </div>

      <Dialog open={filmOpen} onOpenChange={setFilmOpen}>
        <DialogContent className="max-w-5xl bg-black p-0">
          <DialogTitle className="sr-only">Phim ChillnGo</DialogTitle>
          {filmOpen && <video src={FILM_VIDEO} autoPlay controls playsInline className="aspect-video w-full rounded-2xl" />}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/**
 * A hairline-bordered bar; on hover a photo opens out of its middle
 * (clip-path inset 50% → 0) and the label pulls in from the edges.
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
        className={`pointer-events-none absolute left-0 top-1/2 aspect-[11.625/13.125] w-full -translate-y-1/2 overflow-hidden rounded-[0.275em] opacity-0 [clip-path:inset(50%_0%)] group-hover:opacity-100 group-hover:[clip-path:inset(0%)] ${ease}`}
      >
        <img src={FILM_PREVIEW} alt="" loading="lazy" className="size-full object-cover" />
      </span>
      <span className={`relative z-[1] flex w-full items-center justify-between group-hover:w-[90%] ${ease}`}>
        <span className="font-body text-[0.875em] font-medium">Xem phim</span>
        <Play aria-hidden className="size-[0.7em] fill-current" />
      </span>
    </button>
  )
}
