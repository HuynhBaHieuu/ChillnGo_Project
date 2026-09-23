import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { SCRUB, vh } from '@/app/landing/home/config'
import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { scrollToTop } from '@/app/landing/home/lenis'
import { useAuthStore } from '@/store'

const LINKS = [
  { to: '/discover', label: 'Khám phá' },
  { to: '/feed', label: 'Newsfeed' },
  { to: '/itineraries', label: 'Hành trình của tôi' },
  { to: '/posts/new', label: 'Đăng bài mới' },
]

/**
 * Stage F — footer.
 *
 * Scroll:
 *   wordmark   y 20vh → 0 while the footer rises (parallax), scrub true
 *   CTA circle scale 0.6 → 1, opacity 0 → 1 from 'top 90%' to 'top 55%'
 * Hover (time-based): the circle swells to 1.06 and the footer dims slightly
 * behind it — 0.4s power3.out in, 0.3s power2.inOut out. The scroll tween and
 * the hover tween sit on different elements so they never overwrite each other.
 */
export function HomeFooter() {
  const ref = useRef<HTMLElement>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { contextSafe } = useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        gsap.fromTo(
          q('[data-wordmark]'),
          { y: vh(20) },
          {
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: ref.current,
              start: 'top bottom',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
              onUpdate: () => setNavTheme('light'),
            },
          },
        )

        gsap.fromTo(
          q('[data-cta-wrap]'),
          { scale: 0.6, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: q('[data-cta-wrap]')[0],
              start: 'top 90%',
              end: 'top 55%',
              scrub: SCRUB,
            },
          },
        )
      })
    },
    { scope: ref },
  )

  const enter = contextSafe(() => {
    gsap.to('[data-cta]', { scale: 1.06, duration: 0.4, ease: 'power3.out', overwrite: 'auto' })
    gsap.to('[data-dim]', { opacity: 0.06, duration: 0.4, ease: 'power3.out', overwrite: 'auto' })
  })

  const leave = contextSafe(() => {
    gsap.to('[data-cta]', { scale: 1, duration: 0.3, ease: 'power2.inOut', overwrite: 'auto' })
    gsap.to('[data-dim]', { opacity: 0, duration: 0.3, ease: 'power2.inOut', overwrite: 'auto' })
  })

  return (
    <footer
      ref={ref}
      data-reduce-theme="light"
      className="relative overflow-hidden bg-paper text-background"
    >
      <div data-dim aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-0" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-[5.714rem] pt-[6.857rem] text-center">
        <p
          data-wordmark
          aria-hidden
          className="select-none font-display text-[26vw] text-white"
        >
          ChillnGo
        </p>

        <nav
          aria-label="Liên kết cuối trang"
          className="mt-5 flex flex-wrap justify-center gap-x-[1.4286rem] gap-y-[0.571rem] text-sm text-muted-foreground"
        >
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className=" text-sm">
              {link.label}
            </Link>
          ))}
        </nav>

        <div data-cta-wrap className="mt-14">
          <Link
            data-cta
            to={isAuthenticated ? '/posts/new' : '/register'}
            onMouseEnter={enter}
            onMouseLeave={leave}
            onFocus={enter}
            onBlur={leave}
            className="grid size-[max(12vw,160px)] place-items-center rounded-full bg-background px-6 text-center text-sm uppercase leading-snug tracking-[0.02em] text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {isAuthenticated ? 'Đăng hành trình' : 'Bắt đầu ngay'}
          </Link>
        </div>

        <p className="mt-8 max-w-xl text-sm text-muted-foreground">
          Chia sẻ hành trình thật. Clone lịch trình chỉ với một chạm.
        </p>
      </div>

      <div className="relative bg-background text-muted-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 pb-28 pt-[1.4286rem] text-sm md:pb-[1.4286rem]">
          <span>© 2026 ChillnGo</span>
          <button
            type="button"
            onClick={scrollToTop}
            className=" text-sm"
          >
            Về đầu trang ↑
          </button>
        </div>
      </div>
    </footer>
  )
}
