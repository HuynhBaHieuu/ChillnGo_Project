import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength, vh } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, SplitText, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { Magnetic } from '@/app/landing/home/parts/Magnetic'
import { TubesBackground } from '@/app/landing/home/parts/TubesBackground'
import STATEMENT_PHOTO from '@/assets/images/photo-1705736466837-14d8b6fb571c.avif'
import { GlassButton } from '@/components/Button'
import { optionalEnv } from '@/lib/env'
import { landingPhoto } from '@/lib/photos'

/**
 * The hero backdrop is neon tubes that chase the cursor (`TubesBackground`).
 * With reduced motion it falls back to a still: peaks above a sea of cloud, or
 * `VITE_HERO_VIDEO_URL` footage over it with the photo as the poster frame.
 */
const HERO_IMAGE = landingPhoto('saPa', 2400, 1350)
const HERO_VIDEO_URL = optionalEnv(import.meta.env.VITE_HERO_VIDEO_URL)

const STATEMENT =
  'ChillnGo là mạng xã hội của những chuyến đi có thật. Thấy hợp ý? Clone về làm của bạn chỉ với một chạm.'

/**
 * Stage A — the landing hero and the mission statement, on one pin (1 of the
 * page's 2).
 *
 * On load the headline's words rise out of masks. On scroll the hero leaves in
 * layers, then the statement's photo grows from a card to the full screen, the
 * statement's words rise and light up, and both leave. Only transform, opacity
 * and the photo's corner radius animate.
 *
 * Scroll (1 unit = 100vh):
 *   0.00–0.45  copy lifts and fades
 *   0.15–0.75  headline lifts and fades
 *   0.00–0.90  tubes recede
 *   0.30–1.40  photo grows from a card to the full screen
 *   1.00–1.50  statement words rise out of their masks
 *   1.45–2.15  statement lights up word by word
 *   2.25–2.60  statement and photo leave
 *
 * The copy's load-in uses CSS fade-rise classes on *inner* elements and the
 * scroll tweens target the *outer* layers, so the two never fight over one
 * element's transform.
 */
export function IntroStage() {
  const ref = useRef<HTMLElement>(null)
  // Read once: the stage timelines don't re-plan on a live change either.
  const [reduceMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { desktop, reduce } = context.conditions as MediaConditions
        if (reduce) return

        const f = desktop ? 1 : MOBILE_PIN_FACTOR
        const u = (n: number) => n * f
        // Phones show a taller slice of the hero, so the copy travels further.
        const lift = desktop ? 1 : 1.25

        // Words only (no lines), so the split does not depend on the webfont
        // having loaded.
        const title = SplitText.create(q('[data-hero-title]'), {
          type: 'words',
          mask: 'words',
          wordsClass: 'split',
        })
        gsap.from(title.words, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: 0.15 })
        gsap.from(q('[data-layer="range"]'), { opacity: 0, duration: 1.2, ease: 'power3.out' })

        const statement = q('[data-statement]')
        const words = SplitText.create(statement, { type: 'words', mask: 'words', wordsClass: 'split' }).words
        const photo = q('[data-statement-photo]')
        gsap.set(statement, { autoAlpha: 1 })
        gsap.set(words, { opacity: 0.25 })

        const tl = gsap.timeline({ defaults: { ease: 'none' } })

        tl.to(q('[data-layer="lede"]'), { y: vh(-14 * lift), autoAlpha: 0, ease: 'power2.in', duration: u(0.45) }, 0)
        tl.to(q('[data-layer="headline"]'), { y: vh(-10 * lift), autoAlpha: 0, ease: 'power2.in', duration: u(0.6) }, u(0.15))
        // Scale on the layer, fade on its child: the load-in above owns the layer's
        // opacity, and a scrubbed tween on that same property would record the
        // load-in's starting 0 and hold the tubes invisible.
        tl.to(q('[data-layer="range"]'), { scale: 1.2, ease: 'power1.in', duration: u(0.9) }, 0)
        tl.to(q('[data-layer="range"] > *'), { autoAlpha: 0.25, ease: 'power1.in', duration: u(0.9) }, 0)

        tl.fromTo(
          photo,
          { autoAlpha: 0, scale: desktop ? 0.45 : 0.7, y: vh(14), borderRadius: 32 },
          { autoAlpha: 1, scale: 1, y: 0, borderRadius: 0, ease: 'power3.inOut', duration: u(1.1) },
          u(0.3),
        )
        tl.fromTo(q('[data-statement-photo] img'), { scale: 1.25 }, { scale: 1, ease: 'power3.out', duration: u(1.3) }, u(0.3))

        tl.from(words, { yPercent: 110, ease: 'expo.out', duration: u(0.5), stagger: { amount: u(0.35) } }, u(1.0))
        tl.to(words, { opacity: 1, ease: 'power1.out', duration: u(0.12), stagger: { amount: u(0.7) } }, u(1.45))

        tl.to(statement, { y: vh(-6), autoAlpha: 0, ease: 'power2.in', duration: u(0.35) }, u(2.25))
        tl.to(photo, { autoAlpha: 0, scale: 1.04, ease: 'power2.in', duration: u(0.35) }, u(2.25))

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
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} className="relative overflow-hidden bg-background text-foreground">
      {/* Hero */}
      <div className="relative h-screen">
        {/* Layer 1 — the backdrop, furthest from the reader. */}
        <div data-layer="range" className="absolute inset-0 will-change-transform">
          {!reduceMotion ? (
            <div className="size-full bg-forest">
              <TubesBackground />
            </div>
          ) : HERO_VIDEO_URL ? (
            <video autoPlay loop muted playsInline poster={HERO_IMAGE} className="size-full object-cover">
              <source src={HERO_VIDEO_URL} type="video/mp4" />
            </video>
          ) : (
            <img src={HERO_IMAGE} alt="" fetchPriority="high" className="size-full object-cover" />
          )}
        </div>

        {/* A flat scrim, only so white type stays legible over the photograph. */}
        {reduceMotion && <div aria-hidden className="absolute inset-0 bg-forest/65" />}

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-40 pt-32 text-center">
          {/* Layer 2 — the headline. */}
          <div data-layer="headline" className="will-change-transform">
            <h1
              data-hero-title
              className="max-w-5xl font-display text-5xl leading-[0.95] tracking-[-2.46px] text-sand sm:text-7xl md:text-8xl"
            >
              Review &amp; <span className="text-sand/75">Clone</span>
              <br />
              <span className="text-sand/75">Your Journey</span>
            </h1>
          </div>

          {/* Layer 3 — the copy, nearest the reader. */}
          <div data-layer="lede" className="flex flex-col items-center will-change-transform">
            <p className="animate-fade-rise-delay-2 mt-8 max-w-2xl text-base leading-relaxed text-sand sm:text-lg">
              ChillnGo là nơi những chuyến đi có thật được kể lại đầy đủ: từng ngày, từng điểm dừng,
              từng khoản chi. Thấy một hành trình hợp ý? Clone nó về làm của mình chỉ với một chạm,
              rồi sửa theo cách bạn muốn đi.
            </p>

            <Magnetic className="mt-[3.429rem]">
              <GlassButton asChild size="hero" tone="beam" className="animate-fade-rise-delay-3">
                <Link to="/discover">Khám phá ngay</Link>
              </GlassButton>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* Statement — layered over the hero while animated, in flow otherwise.
          `pointer-events-none`: it covers the whole viewport and holds nothing
          interactive, so it must never take clicks aimed at the hero. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 motion-reduce:relative motion-reduce:inset-auto motion-reduce:py-32">
        <div
          data-statement-photo
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-[2rem] opacity-0 will-change-transform motion-reduce:rounded-none motion-reduce:opacity-100"
        >
          <img
            src={STATEMENT_PHOTO}
            alt=""
            loading="lazy"
            className="size-full object-cover brightness-[0.62] contrast-[1.1] saturate-[0.9]"
          />
        </div>

        <p
          data-statement
          className="relative max-w-[20ch] text-center font-display text-[clamp(1.9rem,4.4vw,3.6rem)] leading-[1.1] tracking-tight text-white opacity-0 motion-reduce:opacity-100"
        >
          {STATEMENT}
        </p>
      </div>
    </section>
  )
}
