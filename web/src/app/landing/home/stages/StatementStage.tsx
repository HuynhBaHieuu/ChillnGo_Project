import { useRef } from 'react'

import { MEDIA, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { drawScribbles } from '@/app/landing/home/parts/expedition'
import { Scribble } from '@/app/landing/home/parts/ExpeditionMarks'
import { landingPhoto } from '@/lib/photos'
import type { LandingStats } from '@/services/types'

const formatNumber = new Intl.NumberFormat('vi-VN').format
const BANNER_PHOTO = landingPhoto('riceTerraces', 2400, 2000)

/**
 * The mission statement, then a tall photograph with the platform's
 * real figures set in a narrow column over it. Both in flow (no pin):
 *
 *   statement   heading brightens top-down as it passes (`.xp-fade` mask);
 *               the scribble under the kicker draws on
 *   banner      photo drifts against the scroll; the copy column drifts the
 *               other way, so the two separate as you pass
 */
export function StatementStage({ stats }: { stats: LandingStats }) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()
      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        drawScribbles(ref.current!)

        const fade = q('[data-fade]')[0]
        gsap.fromTo(
          fade,
          { '--mask': -40 },
          { '--mask': 100, ease: 'none', scrollTrigger: { trigger: fade, start: 'top 85%', end: 'bottom 40%', scrub: true } },
        )

        const banner = { trigger: q('[data-banner]')[0], start: 'top bottom', end: 'bottom top', scrub: true }
        gsap.fromTo(q('[data-banner-photo]'), { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: banner })
        gsap.fromTo(
          q('[data-banner-copy]'),
          { y: () => 0.25 * window.innerHeight },
          { y: () => -0.25 * window.innerHeight, ease: 'none', scrollTrigger: { ...banner, invalidateOnRefresh: true } },
        )
      })
    },
    { scope: ref },
  )

  return (
    <div ref={ref}>
      <section data-statement className="bg-background pb-[3em] pt-[6em] text-foreground md:pb-[10em] md:pt-[9em]">
        <div className="mx-auto grid w-[calc(100%-1.5em)] grid-cols-8 gap-x-[0.75em] md:grid-cols-12 md:gap-x-0">
          <div className="col-span-7 col-start-2 flex flex-col items-start gap-[2.5em] md:col-span-6 md:col-start-5">
            <div className="relative">
              <p className="font-display text-[1.125em] font-medium leading-[1.2] text-muted-foreground">Mạng xã hội của những chuyến đi</p>
              <Scribble className="-bottom-[95%] -right-[12%] w-[130%] min-w-[12em]" />
            </div>
            <h2
              data-fade
              className="xp-fade font-display text-[1.625em] font-bold tracking-[-0.035em] leading-none indent-[25%] md:text-[2.625em] md:indent-[33.333%]"
            >
              ChillnGo là nơi những chuyến đi có thật được kể lại trọn vẹn — từng ngày, từng điểm dừng, từng khoản chi. Thấy
              một hành trình hợp ý? Clone về làm của bạn chỉ với một chạm, rồi sửa theo cách bạn muốn đi.
            </h2>
          </div>
        </div>
      </section>

      <section data-banner className="relative h-[100svh] overflow-hidden bg-background md:h-[150svh]">
        <img
          data-banner-photo
          src={BANNER_PHOTO}
          alt=""
          loading="lazy"
          className="absolute inset-x-0 -top-[10%] h-[120%] w-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/25" />

        <div className="relative mx-auto grid w-[calc(100%-1.5em)] grid-cols-8 pt-[35svh] md:grid-cols-12 md:pt-[55svh]">
          <div data-banner-copy className="col-span-6 col-start-2 flex flex-col gap-[0.75em] text-white md:col-span-2 md:col-start-3">
            <p className="font-mono text-[0.75em] uppercase leading-[1.2] tracking-[0.12em] text-primary">Con số thật</p>
            <p className="font-body text-[0.875em] font-medium leading-[1.5]">
              Không có lịch trình dựng sẵn, chỉ có người đã đi và kể lại. Đến nay cộng đồng đã chia sẻ{' '}
              {formatNumber(stats.tripCount)} hành trình với {formatNumber(stats.stopCount)} điểm dừng có toạ độ, được clone{' '}
              {formatNumber(stats.cloneCount)} lần và lưu lại {formatNumber(stats.bookmarkCount)} lần.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
