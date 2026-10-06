import { useRef } from 'react'

import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import type { MediaConditions } from '@/app/landing/home/gsap'
import { slideInWords } from '@/app/landing/home/parts/slideInWords'
import { landingPhoto } from '@/lib/photos'

/**
 * The three things you do on ChillnGo, in order. Every line is a feature that
 * actually exists in the app.
 */
const STEPS = [
  {
    name: 'Khám phá',
    title: 'Khám phá hành trình thật',
    photo: landingPhoto('haLong', 1200, 900),
    points: [
      ['Lọc theo vùng, mùa và ngân sách', ' để ra đúng kiểu chuyến bạn muốn.'],
      ['Xem từng ngày:', ' mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.'],
    ],
  },
  {
    name: 'Clone',
    title: 'Clone về và sửa theo ý bạn',
    photo: landingPhoto('mountainRoad', 1200, 900),
    points: [
      ['Clone một chạm', ' biến chuyến đi của người khác thành bản nháp của bạn.'],
      ['Kéo thả để đổi thứ tự ngày,', ' ngày tháng tự cập nhật theo.'],
      ['Ghép nhiều chuyến:', ' lấy những ngày hay nhất từ nhiều bài.'],
    ],
  },
  {
    name: 'Chia sẻ',
    title: 'Đi xong, chia sẻ lại',
    photo: landingPhoto('beach', 1200, 900),
    points: [['Đăng hành trình của bạn', ' cho người đi sau tham khảo và clone tiếp.']],
  },
] as const

/** Height of one index row plus the gap below it, in px (h-[52px] + gap-1.5). */
const INDEX_STEP = 58

/**
 * Stage C — how it works, in flow (no pin).
 *
 * Desktop: the heading and a three-step index stay put (CSS sticky) on the
 * left while the steps scroll past on the right. Each step's photo opens out
 * of a smaller rounded window as it rises (clip-path, scrubbed) while the
 * picture inside settles from a slight zoom; its copy rises in once it reaches
 * the middle. The index lights the step under the middle of the screen and
 * its marker slides to it.
 *
 * Photos keep their own colours: only a little exposure comes off so they sit
 * on the black ground.
 */
export function HowItWorksStage() {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref)
      const mm = gsap.matchMedia()

      mm.add(MEDIA, (context) => {
        const { reduce } = context.conditions as MediaConditions
        if (reduce) return

        slideInWords(q('[data-heading]')[0])

        const indexItems = q('[data-index-item]')
        const marker = gsap.quickTo(q('[data-index-marker]'), 'y', { duration: 0.7, ease: 'expo.out' })

        q('[data-step]').forEach((step, i) => {
          const frame = step.querySelector('[data-frame]')
          const picture = step.querySelector('[data-frame] img')

          gsap.fromTo(
            frame,
            { clipPath: 'inset(16% 14% 16% 14% round 28px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 16px)',
              ease: 'none',
              scrollTrigger: { trigger: frame, start: 'top 92%', end: 'top 35%', scrub: true },
            },
          )
          gsap.fromTo(
            picture,
            { scale: 1.3, yPercent: -6 },
            { scale: 1, yPercent: 6, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } },
          )
          gsap.from(step.querySelectorAll('[data-copy]'), {
            y: 28,
            autoAlpha: 0,
            duration: 0.9,
            ease: 'expo.out',
            stagger: 0.08,
            scrollTrigger: { trigger: step, start: 'top 60%', toggleActions: 'play none none reverse' },
          })

          ScrollTrigger.create({
            trigger: step,
            start: 'top center',
            end: 'bottom center',
            onToggle: (self) => {
              if (!self.isActive) return
              indexItems.forEach((item, j) => (item.dataset.active = String(j === i)))
              marker(i * INDEX_STEP)
            },
          })
        })

        return () => indexItems.forEach((item, j) => (item.dataset.active = String(j === 0)))
      })
    },
    { scope: ref },
  )

  return (
    <section
      ref={ref}
      className="relative mx-auto grid max-w-7xl grid-cols-1 gap-[clamp(24px,6vw,96px)] bg-background px-6 py-[18vh] text-foreground md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:px-14"
    >
      <div className="grid gap-7 self-start md:sticky md:top-[22vh]">
        <h2
          data-heading
          className="font-display text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]"
        >
          Cách ChillnGo hoạt động
        </h2>

        <div aria-hidden className="relative hidden pl-[18px] md:block motion-reduce:hidden">
          <span className="absolute inset-y-0 left-0 w-px bg-border" />
          <span
            data-index-marker
            className="absolute left-0 top-0 h-[52px] w-px bg-primary will-change-transform"
          />
          <ol className="grid gap-1.5">
            {STEPS.map((step, i) => (
              <li
                key={step.name}
                data-index-item
                data-active={i === 0}
                className="flex h-[52px] items-center gap-3.5 font-display text-[clamp(1.2rem,2vw,1.6rem)] font-semibold tracking-[-0.02em] text-foreground/30 transition-colors duration-500 data-[active=true]:text-foreground"
              >
                <small className="font-mono text-xs font-normal text-muted-foreground">0{i + 1}</small>
                {step.name}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div>
        {STEPS.map((step) => (
          <article
            key={step.name}
            data-step
            className="grid content-center gap-[22px] py-[6vh] md:min-h-[92vh] md:py-0"
          >
            <div data-frame className="relative aspect-[4/3] overflow-hidden rounded-2xl will-change-[clip-path]">
              <img
                src={step.photo}
                alt=""
                loading="lazy"
                className="absolute inset-x-0 -top-[8%] h-[116%] w-full object-cover brightness-[0.82] contrast-[1.06] will-change-transform"
              />
            </div>
            <h3
              data-copy
              className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.1] tracking-[-0.03em]"
            >
              {step.title}
            </h3>
            <ul className="grid max-w-[52ch] gap-2.5">
              {step.points.map(([lead, rest]) => (
                <li
                  key={lead}
                  data-copy
                  className="relative pl-[18px] text-muted-foreground before:absolute before:left-0 before:top-[0.72em] before:h-px before:w-2 before:bg-primary"
                >
                  <b className="font-medium text-foreground">{lead}</b>
                  {rest}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
