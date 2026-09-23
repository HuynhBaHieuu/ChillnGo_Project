import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength, vh } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, SplitText, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { inkColor, mutedInkColor } from '@/app/landing/home/palette'
import { CharLayers } from '@/app/landing/home/parts/CharLayers'
import { GlassButton } from '@/components/Button'
import { optionalEnv } from '@/lib/env'
import { landingPhoto } from '@/lib/photos'

/**
 * The hero backdrop: peaks above a sea of cloud, the sight the whole product is
 * about. Set `VITE_HERO_VIDEO_URL` in `.env.local` to play footage over it
 * instead; the photo then serves as the poster frame.
 */
const HERO_IMAGE = landingPhoto('saPa', 2400, 1350)
const HERO_VIDEO_URL = optionalEnv(import.meta.env.VITE_HERO_VIDEO_URL)

const STATEMENT = [
  'ChillnGo là mạng xã hội của những chuyến đi có thật.',
  'Mỗi hành trình được kể lại từng ngày, từng điểm dừng, từng khoản chi.',
  'Thấy hợp ý? Clone về làm của bạn chỉ với một chạm.',
]

/*
 * The statement lights up from a muted purple to the full ink — see
 * `../palette`. It used to light up to white, which was right when the ground
 * closing over the hero was forest; under Arcade Neon Pop that ground is the
 * pink `--background`, and white on it was unreadable.
 */

/**
 * Stage A — the landing hero and the mission statement, on one pin.
 *
 * They share a pin because the statement starts materialising while the hero is
 * still flying apart; two separate pins could not overlap like that.
 *
 * The hero leaves as a parallax: three layers travelling at three speeds, which
 * is what reads as depth. The range is furthest from the reader and moves
 * least; the copy is nearest and clears first. Nothing here animates anything
 * but transform and opacity — no blur, which the compositor cannot cheat and
 * which turns a 4K photograph into a slideshow on a mid-range laptop.
 *
 * Scroll (1 unit = 100vh):
 *   0.00–1.50  range drifts up 4vh and swells 1.12 → 1.18
 *   0.00–1.50  headline rises 22vh, copy rises 34vh
 *   0.25–0.90  copy fades, then the headline behind it
 *   0.45–1.50  the forest ground closes over the photograph
 *   0.90–2.10  statement drifts in from "distance" (scale 0.82 → 1)
 *   2.10–3.50  statement lights up character by character
 *   3.50–4.00  statement leaves
 *
 * The load-in uses the design system's CSS fade-rise classes on *inner*
 * wrappers, and scroll tweens target the *outer* wrappers, so the two never
 * fight over the same element's transform.
 */
export function IntroStage() {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f
        // Phones show a taller slice of the photo, so the copy has further to
        // travel before it is off screen.
        const lift = desktop ? 1 : 1.25
        // The navbar follows the ground under it: white over the footage, ink
        // once the pink has closed over it. Switched at 85% of the ground's
        // fade rather than at its end, so the links are never white on pink.
        const lightFrom = u(0.45 + 1.05 * 0.85)
        const tint = mutedInkColor()
        const lit = inkColor()

        gsap.from(q('[data-layer="range"]'), {
          opacity: 0,
          duration: 1.2,
          ease: 'power3.out',
        })

        const split = SplitText.create(q('[data-chars]'), { type: 'words,chars', tag: 'span' })
        const lines = q('[data-line]')
        const statement = q('[data-statement]')

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          onUpdate: () => setNavTheme(tl.time() >= lightFrom ? 'light' : 'dark'),
        })

        // Hero leaves as three layers at three speeds.
        tl.to(q('[data-layer="range"]'), { y: vh(-4), scale: 1.18, duration: u(1.5) }, 0)
        tl.to(q('[data-layer="headline"]'), { y: vh(-22 * lift), duration: u(1.5) }, 0)
        tl.to(q('[data-layer="lede"]'), { y: vh(-34 * lift), duration: u(1.5) }, 0)

        // The copy goes first, so the headline is alone for a beat.
        tl.to(q('[data-layer="lede"]'), { opacity: 0, duration: u(0.4), ease: 'power3.out' }, u(0.25))
        tl.to(lines, { opacity: 0, duration: u(0.45), ease: 'power3.out' }, u(0.55))
        tl.fromTo(q('[data-ground]'), { opacity: 0 }, { opacity: 1, duration: u(1.05) }, u(0.45))

        /*
         * Statement approaches, lights up, leaves.
         *
         * It starts at 0.90, while the headline is still fading out at 1.00.
         * Held until 1.20, as it was, the pin spent a fifth of a unit — about
         * 190px of scroll — showing nothing but the ground closing over an
         * empty photograph.
         */
        tl.fromTo(
          statement,
          { opacity: 0, scale: 0.82, y: vh(8) },
          { opacity: 1, scale: 1, y: 0, ease: 'power3.out', duration: u(1.2) },
          u(0.9),
        )
        tl.fromTo(
          split.chars,
          { opacity: 0, color: tint },
          { opacity: 1, color: lit, duration: u(0.08), stagger: { amount: u(1.32) } },
          u(2.1),
        )
        tl.to(
          statement,
          {
            opacity: 0,
            scale: 1.06,
            y: vh(-6),
            ease: 'power3.out',
            duration: u(0.5),
            immediateRender: false,
          },
          u(3.5),
        )

        // Pad to the exact length so 1 unit of timeline = 100vh of scroll.
        tl.set({}, {}, u(UNITS.intro))

        ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end: pinLength(u(UNITS.intro)),
          pin: true,
          scrub: SCRUB,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
        })

        return () => split.revert()
      })
    },
    { scope: ref },
  )

  return (
    <section
      ref={ref}
      data-reduce-theme="dark"
      className="relative overflow-hidden bg-background text-foreground"
    >
      {/* Hero */}
      <div className="relative h-screen">
        {/* Layer 1 — the range. It starts oversized so that drifting up during
            the parallax never walks an edge into frame. */}
        <div
          data-layer="range"
          className="absolute inset-0 scale-[1.12] will-change-transform motion-reduce:scale-100"
        >
          {HERO_VIDEO_URL ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              poster={HERO_IMAGE}
              className="size-full object-cover"
            >
              <source src={HERO_VIDEO_URL} type="video/mp4" />
            </video>
          ) : (
            <img
              src={HERO_IMAGE}
              alt=""
              fetchPriority="high"
              className="size-full object-cover"
            />
          )}
        </div>

        {/* A flat scrim, not a gradient blob — it only exists so white type
            stays legible over the photograph. Forest rather than black, so the
            shadows warm towards the palette instead of going grey. */}
        <div aria-hidden className="absolute inset-0 bg-forest/65" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-40 pt-32 text-center">
          {/* Layer 2 — the headline, at mid depth. */}
          <div data-layer="headline" className="will-change-transform">
            <h1 className="max-w-5xl font-display text-5xl leading-[0.95] tracking-[-2.46px] text-sand sm:text-7xl md:text-8xl">
              <span data-line="1" className="block">
                <span className="animate-fade-rise block">
                  Review &amp; <em className="not-italic text-sand/80">Clone</em>
                </span>
              </span>
              <span data-line="2" className="block">
                <span className="animate-fade-rise-delay block">
                  <em className="not-italic text-sand/80">Your Journey</em>
                </span>
              </span>
            </h1>
          </div>

          {/* Layer 3 — the copy, nearest the reader, so it travels furthest. */}
          <div data-layer="lede" className="flex flex-col items-center will-change-transform">
            <p className="animate-fade-rise-delay-2 mt-8 max-w-2xl text-base leading-relaxed text-sand sm:text-lg">
              ChillnGo là nơi những chuyến đi có thật được kể lại đầy đủ — từng ngày,
              từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Clone nó về
              làm của mình chỉ với một chạm, rồi sửa theo cách bạn muốn đi. Không còn
              phải dựng lịch trình từ con số không.
            </p>

            <GlassButton
              asChild
              size="hero"
              tone="sunset"
              className="animate-fade-rise-delay-3 mt-[3.429rem]"
            >
              <Link to="/discover">Khám phá ngay</Link>
            </GlassButton>
          </div>
        </div>
      </div>

      <div
        data-ground
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-background opacity-0"
      />

      {/* Statement — layered over the hero while animated, in flow otherwise.

          `pointer-events-none` because it covers the whole viewport at z-10:
          invisible at `opacity-0`, it still took every click aimed at the hero
          beneath it, the CTA included. It holds no interactive content of its
          own, so it never needs the pointer. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 motion-reduce:static motion-reduce:py-32">
        <div
          data-statement
          className="max-w-4xl space-y-8 text-center opacity-0 will-change-transform motion-reduce:opacity-100"
        >
          {STATEMENT.map((line) => (
            <CharLayers
              key={line}
              text={line}
              className="font-display text-[clamp(1.75rem,3.4vw,3.25rem)] leading-[1.1] tracking-tight"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
