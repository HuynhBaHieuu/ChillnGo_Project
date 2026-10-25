import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { SCRUB } from '@/app/landing/home/config'
import { MEDIA, SplitText, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { scrollToTop } from '@/app/landing/home/lenis'
import { Magnetic } from '@/app/landing/home/parts/Magnetic'
import { slideInWords } from '@/app/landing/home/parts/slideInWords'
import { t, translatedList } from '@/i18n'
import { useAuthStore } from '@/store'

const LINKS = translatedList([
  { to: '/discover', label: 'Khám phá' },
  { to: '/feed', label: 'Newsfeed' },
  { to: '/itineraries', label: 'Hành trình của tôi' },
  { to: '/posts/new', label: 'Đăng bài mới' },
], ['label'])

/**
 * Stage F — footer.
 *
 * The heading slides in with the scroll; the big wordmark rises letter by
 * letter out of masks as the page runs out (scrubbed); the CTA leans toward
 * the cursor (Magnetic).
 */
export function HomeFooter() {
  const ref = useRef<HTMLElement>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        slideInWords(q('[data-heading]')[0])

        const mark = SplitText.create(q('[data-wordmark]'), { type: 'chars', mask: 'chars', charsClass: 'split' })
        gsap.from(mark.chars, {
          yPercent: 100,
          ease: 'power3.out',
          stagger: 0.04,
          scrollTrigger: { trigger: ref.current, start: 'top 70%', end: 'bottom bottom', scrub: SCRUB },
        })
      })
    },
    { scope: ref },
  )

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-border bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-8 px-6 pt-[16vh] md:px-14">
        <h2
          data-heading
          className="max-w-[14ch] font-display text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.035em]"
        >
          {t('Chuyến tiếp theo bắt đầu từ đây')}
        </h2>
        <Magnetic>
          <Link
            to={isAuthenticated ? '/posts/new' : '/register'}
            className="inline-grid place-items-center rounded-full bg-foreground px-9 py-[18px] font-display text-[15px] font-bold tracking-[-0.01em] text-background transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {isAuthenticated ? t('Đăng hành trình') : t('Bắt đầu ngay')}
          </Link>
        </Magnetic>
      </div>

      {/* Sized from its own width: "ChillnGo" sets about 5.6em wide in the
          display face, so this spans ~92vw. Recompute if the face changes. */}
      <p
        data-wordmark
        aria-hidden
        className="mt-[12vh] select-none whitespace-nowrap text-center font-display text-[calc(92vw/5.6)] font-extrabold leading-[0.9] tracking-[-0.05em] text-foreground/10"
      >
        ChillnGo
      </p>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 pb-28 pt-10 text-sm text-muted-foreground md:px-14 md:pb-10">
        <span>© 2026 ChillnGo</span>
        <nav aria-label={t('Liên kết cuối trang')} className="flex flex-wrap gap-x-[1.4286rem] gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={scrollToTop} className="transition-colors hover:text-foreground">
            {t('Về đầu trang')} ↑
          </button>
        </nav>
      </div>
    </footer>
  )
}
