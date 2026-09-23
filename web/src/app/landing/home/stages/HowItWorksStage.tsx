import { useRef } from 'react'

import { MOBILE_PIN_FACTOR, SCRUB, UNITS, pinLength } from '@/app/landing/home/config'
import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { setNavTheme } from '@/app/landing/home/navTheme'
import { Dome } from '@/app/landing/home/parts/Dome'
import { addDome } from '@/app/landing/home/parts/domeTween'
import { cn } from '@/lib/utils'

/** Every item here is a feature that actually exists in the app. */
const FEATURES = [
  { title: 'Khám phá hành trình', desc: 'Lịch trình thật, lọc theo vùng, mùa và ngân sách.' },
  { title: 'Xem từng ngày', desc: 'Mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.' },
  { title: 'Clone một chạm', desc: 'Biến chuyến đi của người khác thành bản nháp của bạn.' },
  { title: 'Sắp xếp lại ngày', desc: 'Kéo thả để đổi thứ tự — ngày tháng tự cập nhật theo.' },
  { title: 'Ghép nhiều chuyến', desc: 'Lấy những ngày hay nhất từ nhiều bài, gộp vào một lịch trình.' },
  { title: 'Chia sẻ lại', desc: 'Đi xong, đăng hành trình của bạn cho người đi sau.' },
]

/** Band geometry, as fractions of the viewport height. */
const BAND_TOP = 0.36
const ITEM_H = 0.28

/**
 * Stage C — the feature list sliding through a fixed forest band.
 *
 * The list is rendered twice and both copies move together. The base copy is
 * faint ink; the second copy is the ground colour and sits inside a *stationary*
 * wrapper clipped to the band, so text flips exactly where it crosses the band —
 * even an item half in, half out.
 *
 * Scroll (1 unit = 100vh, N = 6 items → 2.8 units):
 *   0.0–0.3        band grows up from its bottom edge
 *   0.0–end        list travels from 30vh below the band to 20vh past its last item
 *   end−0.5→−0.2   band collapses toward its top edge
 *   end−0.6→end    forest dome rises; nav turns dark once it covers the top
 * Per frame: items above the band blur (0→5px over 30vh). When the item in the
 * band changes, its description crossfades (time-based, 0.2s out / 0.35s in).
 */
export function HowItWorksStage() {
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
        const n = FEATURES.length
        const total = u(UNITS.howItWorks(n))
        const domeAt = total - u(0.6)

        const band = q('[data-band]')[0]
        const lists = q('[data-list]')
        const baseList = lists[0]
        const items = Array.from(baseList.querySelectorAll<HTMLElement>('[data-item]'))
        const descs = q('[data-desc]')

        const setBlur = items.map((el) => gsap.quickSetter(el, 'filter'))
        const setOpacity = items.map((el) => gsap.quickSetter(el, 'opacity'))
        const lastBlur = items.map(() => -1)
        let active = -1

        const showDescription = (next: number) => {
          if (next === active) return
          if (active >= 0) {
            gsap.to(descs[active], { opacity: 0, y: -8, duration: 0.2, ease: 'power1.in', overwrite: true })
          }
          if (next >= 0) {
            gsap.fromTo(
              descs[next],
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.35, delay: 0.05, ease: 'power2.out', overwrite: true },
            )
          }
          active = next
        }

        const perFrame = () => {
          const h = window.innerHeight * ITEM_H
          const bandTop = window.innerHeight * BAND_TOP
          const fade = window.innerHeight * 0.3
          const y = gsap.getProperty(baseList, 'y') as number

          items.forEach((_, i) => {
            const center = bandTop + y + i * h + h / 2
            const t = center < bandTop ? Math.min((bandTop - center) / fade, 1) : 0
            const blur = Math.round(t * 50) / 10
            if (blur !== lastBlur[i]) {
              setBlur[i](`blur(${blur}px)`)
              setOpacity[i](1 - 0.4 * t)
              lastBlur[i] = blur
            }
          })

          // The item whose slot is currently inside the band, if any.
          const slot = -y / h
          showDescription(slot > -0.5 && slot < n - 0.5 ? Math.round(slot) : -1)

          setNavTheme('light')
        }

        const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: perFrame })

        tl.fromTo(
          band,
          { scaleY: 0, transformOrigin: '50% 100%' },
          { scaleY: 1, ease: 'power2.out', duration: u(0.3) },
          0,
        )
        tl.fromTo(
          lists,
          { y: () => window.innerHeight * 0.3 },
          {
            y: () => -((n - 1) * window.innerHeight * ITEM_H + window.innerHeight * 0.2),
            duration: total,
          },
          0,
        )
        tl.set(band, { transformOrigin: '50% 0%' }, total - u(0.5))
        tl.to(band, { scaleY: 0, ease: 'power2.in', duration: u(0.3) }, total - u(0.5))
        addDome(tl, q('[data-dome]')[0], domeAt, u(0.6))
        tl.set({}, {}, total)

        ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end: pinLength(total),
          pin: true,
          scrub: SCRUB,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
        })

        return () => {
          gsap.set(descs, { clearProps: 'all' })
          gsap.set(items, { clearProps: 'filter,opacity' })
        }
      })
    },
    { scope: ref },
  )

  return (
    <section
      ref={ref}
      data-reduce-theme="light"
      className="relative h-screen overflow-hidden bg-paper text-foreground motion-reduce:h-auto motion-reduce:py-24"
    >
      <div
        data-band
        aria-hidden
        className="absolute inset-x-0 top-[36vh] h-[28vh] bg-foreground motion-reduce:hidden"
        style={{ transform: 'scaleY(0)' }}
      />

      {/* Section label. Outside [data-list] so it holds its place while the
          list travels past it. */}
      <p className="absolute left-6 top-[29vh] text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/60 md:left-[27vw] motion-reduce:static motion-reduce:mb-8 motion-reduce:px-6">
        Cách ChillnGo hoạt động
      </p>

      {/* Base list — faint ink. */}
      <div data-list className="absolute inset-x-0 top-[36vh] motion-reduce:static">
        <FeatureList tone="base" />
      </div>

      {/* Highlighted copy, clipped to the band by a wrapper that does not move. */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{ clipPath: `inset(${BAND_TOP * 100}vh 0 ${(1 - BAND_TOP - ITEM_H) * 100}vh 0)` }}
      >
        <div data-list className="absolute inset-x-0 top-[36vh]">
          <FeatureList tone="highlight" />
        </div>
      </div>

      {/* Descriptions, inside the band on the left. */}
      <div className="pointer-events-none absolute left-[2.5vw] top-[36vh] hidden h-[28vh] w-[20vw] items-center md:flex motion-reduce:hidden">
        {FEATURES.map((feature) => (
          <p
            key={feature.title}
            data-desc
            className="absolute max-w-xl text-base text-background opacity-0"
          >
            {feature.desc}
          </p>
        ))}
      </div>

      <Dome tone="ground" />
    </section>
  )
}

function FeatureList({ tone }: { tone: 'base' | 'highlight' }) {
  return (
    <ul>
      {FEATURES.map((feature) => (
        <li
          key={feature.title}
          data-item
          className="flex h-[28vh] flex-col justify-center pl-6 pr-6 md:pl-[27vw] motion-reduce:h-auto motion-reduce:py-5"
        >
          <h3
            className={cn(
              'font-display text-[clamp(2.75rem,7vw,8rem)]',
              tone === 'base'
                ? 'text-foreground/15 motion-reduce:text-foreground'
                : 'text-background',
            )}
          >
            {feature.title}
          </h3>
          {tone === 'base' && (
            <p className="mt-2 hidden text-sm text-foreground/70 motion-reduce:block">
              {feature.desc}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
