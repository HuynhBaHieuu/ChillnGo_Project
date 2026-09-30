import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { cn } from '@/lib/utils'

gsap.registerPlugin(CustomEase)
const SWITCH_EASE = CustomEase.create('dimensional-switch', '0.76,0,0.24,1')

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true

export interface SlideItem {
  image: string
  /** Optional caption shown over the slide. */
  text?: string
}

interface DimensionalSwitchSliderProps {
  items: SlideItem[]
  /** Spacing and placement of the whole slider, controls included. */
  className?: string
  /** Size and shape of the image stage, e.g. an aspect ratio and rounding. */
  stageClassName?: string
  /** Accessible name of the carousel. */
  label?: string
  /** Seconds one switch takes. */
  duration?: number
}

/** Horizontal drag, in px, that counts as a swipe. */
const SWIPE_THRESHOLD = 40

/**
 * Image slider where each switch turns the stage like a cube face: the current
 * slide swings back and away while the next one swings in from the side it
 * was asked for. Under the stage sit one bar per slide and the arrows; the
 * bars, arrows, arrow keys and swiping all switch.
 * With reduced motion the slides simply swap.
 */
export function DimensionalSwitchSlider({
  items,
  className,
  stageClassName,
  label = 'Ảnh',
  duration = 1.1,
}: DimensionalSwitchSliderProps) {
  const [index, setIndex] = useState(0)
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const caption = useRef<HTMLParagraphElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const dragStart = useRef<number | null>(null)
  const count = items.length

  useEffect(() => () => void timeline.current?.kill(), [])

  // The caption rises in once the new slide is mostly in place.
  useEffect(() => {
    if (!caption.current || prefersReducedMotion()) return
    gsap.fromTo(
      caption.current,
      { yPercent: 60, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.6, delay: timeline.current ? duration * 0.45 : 0, ease: 'power3.out' },
    )
  }, [index, duration])

  const go = useCallback(
    (to: number, dir: 1 | -1) => {
      if (count < 2 || to === index || timeline.current?.isActive()) return
      const from = slides.current[index]
      const next = slides.current[to]
      if (!from || !next) return
      setIndex(to)

      const part = (slide: HTMLDivElement, name: string) => slide.querySelector<HTMLElement>(`[data-part="${name}"]`)

      if (prefersReducedMotion()) {
        gsap.set(from, { autoAlpha: 0, zIndex: 0 })
        gsap.set(next, { autoAlpha: 1, zIndex: 1 })
        return
      }

      timeline.current = gsap
        .timeline({
          defaults: { duration, ease: SWITCH_EASE },
          onComplete: () => {
            gsap.set(from, { autoAlpha: 0, zIndex: 0, clearProps: 'transform' })
            gsap.set(part(from, 'image'), { clearProps: 'transform' })
            gsap.set(part(from, 'shade'), { opacity: 0 })
          },
        })
        .set(from, { zIndex: 1 })
        .set(next, { autoAlpha: 1, zIndex: 2, xPercent: dir * 70, z: -500, rotateY: dir * 40 })
        .set(part(next, 'shade'), { opacity: 0.7 })
        // Out: swing away to the opposite side and darken.
        .to(from, { xPercent: dir * -70, z: -500, rotateY: dir * -40 }, 0)
        .to(part(from, 'image'), { scale: 1.25 }, 0)
        .to(part(from, 'shade'), { opacity: 0.7 }, 0)
        // In: swing forward from the side, the photo settling from a zoom.
        .to(next, { xPercent: 0, z: 0, rotateY: 0 }, 0)
        .fromTo(part(next, 'image'), { scale: 1.35 }, { scale: 1 }, 0)
        .to(part(next, 'shade'), { opacity: 0 }, 0)
    },
    [count, index, duration],
  )

  const nextSlide = () => go((index + 1) % count, 1)
  const prevSlide = () => go((index - 1 + count) % count, -1)

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') nextSlide()
    else if (event.key === 'ArrowLeft') prevSlide()
    else return
    event.preventDefault()
  }

  function onPointerDown(event: PointerEvent) {
    dragStart.current = event.clientX
  }

  function onPointerUp(event: PointerEvent) {
    if (dragStart.current === null) return
    const dx = event.clientX - dragStart.current
    dragStart.current = null
    if (dx <= -SWIPE_THRESHOLD) nextSlide()
    else if (dx >= SWIPE_THRESHOLD) prevSlide()
  }

  if (count === 0) return null
  const current = items[Math.min(index, count - 1)]
  const multiple = count > 1

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={multiple ? onKeyDown : undefined}
      className={cn(
        'rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background',
        className,
      )}
    >
      <div
        onPointerDown={multiple ? onPointerDown : undefined}
        onPointerUp={multiple ? onPointerUp : undefined}
        onPointerCancel={() => (dragStart.current = null)}
        className={cn('relative isolate touch-pan-y select-none overflow-hidden bg-black', stageClassName)}
        style={{ perspective: '1600px' }}
      >
        <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {items.map((item, i) => (
            <div
              key={`${item.image}-${i}`}
              ref={(el) => {
                slides.current[i] = el
              }}
              aria-hidden={i !== index}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              className="absolute inset-0 overflow-hidden will-change-transform [backface-visibility:hidden]"
              // Fixed per slide, so React never fights GSAP over it after mount.
              style={i === 0 ? { zIndex: 1 } : { opacity: 0, visibility: 'hidden' }}
            >
              <img
                data-part="image"
                src={item.image}
                alt={item.text ?? ''}
                draggable={false}
                className="size-full object-cover"
              />
              <div data-part="shade" className="pointer-events-none absolute inset-0 bg-black opacity-0" />
            </div>
          ))}
        </div>

        {current.text && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
            <p
              ref={caption}
              className="max-w-3xl text-balance text-center font-display text-3xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl"
            >
              {current.text}
            </p>
          </div>
        )}
      </div>

      {multiple && (
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`${item.image}-${i}`}
                type="button"
                onClick={() => go(i, i > index ? 1 : -1)}
                aria-label={`Xem ảnh ${i + 1}`}
                aria-current={i === index}
                className="group/bar py-2"
              >
                <span
                  className={cn(
                    'block h-[3px] rounded-full transition-all duration-500',
                    i === index ? 'w-6 bg-orange-600' : 'w-3 bg-foreground/25 group-hover/bar:bg-foreground/60',
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Ảnh trước"
              className="grid size-9 place-items-center rounded-full border border-border bg-foreground/5 text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/15"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Ảnh tiếp theo"
              className="grid size-9 place-items-center rounded-full bg-orange-600 text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-orange-500"
            >
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>

          <p className="sr-only" aria-live="polite">
            Ảnh {index + 1} / {count}
          </p>
        </div>
      )}
    </div>
  )
}
