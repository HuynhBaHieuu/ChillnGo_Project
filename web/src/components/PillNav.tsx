import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

export type PillNavItem = {
  to: string
  label: string
  /** Match the route exactly, as NavLink's `end`. */
  end?: boolean
  /** Rendered after the label, e.g. a live count. */
  badge?: ReactNode
}

type PillNavProps = {
  items: readonly PillNavItem[]
  className?: string
  /** GSAP ease for the hover fill and label swap. */
  ease?: string
}

/**
 * The navbar swaps between its transparent (home) and glass variants on route
 * change, which remounts this. The entrance plays on first load only, not on
 * every trip to and from the home page.
 */
let entrancePlayed = false

/**
 * The hover on every `[data-nav-pill]` under `rootRef`: a circle rises from
 * below to fill the pill while the label slides up and a dark copy slides in
 * behind it. Rebuilt when `key` (the set of pills) changes.
 */
function usePillHover(rootRef: RefObject<HTMLElement | null>, key: string, ease: string, entrance: boolean) {
  useGSAP(
    (_, contextSafe) => {
      const root = rootRef.current
      if (!root || !contextSafe) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const cleanups = gsap.utils.toArray<HTMLElement>('[data-nav-pill]', root).map((pill) => {
        const circle = pill.querySelector<HTMLElement>('[data-pill-circle]')
        const label = pill.querySelector<HTMLElement>('[data-pill-label]')
        const hoverLabel = pill.querySelector<HTMLElement>('[data-pill-label-hover]')
        if (!circle || !label || !hoverLabel) return () => {}

        let tl: gsap.core.Timeline | null = null
        let tween: gsap.core.Tween | null = null

        // Size the circle so that, anchored below the pill, it just covers the
        // pill's corners when fully grown. Rebuilt whenever the pill resizes.
        const build = contextSafe(() => {
          // Layout size, not getBoundingClientRect: an ancestor mid-way through a
          // scale-in would give a shrunken size, and the ResizeObserver never
          // fires again to correct it.
          const [w, h] = [pill.offsetWidth, pill.offsetHeight]
          if (!w || !h) return
          const radius = (w * w / 4 + h * h) / (2 * h)
          const diameter = Math.ceil(2 * radius) + 2
          const delta = Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - w * w / 4))) + 1

          circle.style.width = `${diameter}px`
          circle.style.height = `${diameter}px`
          circle.style.bottom = `-${delta}px`

          const progress = tl?.progress() ?? 0
          tl?.kill()
          gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${diameter - delta}px` })
          gsap.set(label, { y: 0 })
          gsap.set(hoverLabel, { y: h + 12, opacity: 0 })

          tl = gsap
            .timeline({ paused: true })
            .to(circle, { scale: 1.2, xPercent: -50, duration: 0.8, ease }, 0)
            .to(label, { y: -(h + 8), duration: 0.6, ease }, 0)
            .to(hoverLabel, { y: 0, opacity: 1, duration: 0.6, ease }, 0)
            .progress(progress)
        })

        const tweenTo = contextSafe((to: number, duration: number) => {
          if (!tl) return
          tween?.kill()
          if (reduceMotion) {
            tl.progress(to ? 1 : 0)
            return
          }
          tween = tl.tweenTo(to ? tl.duration() : 0, { duration, ease })
        })
        const enter = () => tweenTo(1, 0.4)
        const leave = () => tweenTo(0, 0.3)

        build()
        const observer = new ResizeObserver(build)
        observer.observe(pill)
        pill.addEventListener('mouseenter', enter)
        pill.addEventListener('mouseleave', leave)
        pill.addEventListener('focus', enter)
        pill.addEventListener('blur', leave)

        return () => {
          observer.disconnect()
          pill.removeEventListener('mouseenter', enter)
          pill.removeEventListener('mouseleave', leave)
          pill.removeEventListener('focus', enter)
          pill.removeEventListener('blur', leave)
        }
      })

      if (entrance && !entrancePlayed && !reduceMotion) {
        gsap.from(root.querySelectorAll('li'), {
          opacity: 0,
          x: -12,
          duration: 0.6,
          stagger: 0.05,
          ease: 'power2.out',
          delay: 0.2,
        })
      }
      if (entrance) entrancePlayed = true

      return () => cleanups.forEach((cleanup) => cleanup())
    },
    { scope: rootRef, dependencies: [key, ease] },
  )
}

/**
 * Colours are CSS variables on the root, defaulting to the theme tokens, so a
 * caller can re-skin it through `className` without new props.
 */
const ROOT_CLASS = cn(
  '[--pill-base:hsl(var(--card))] [--pill-text:hsl(var(--muted-foreground))]',
  '[--pill-active-text:hsl(var(--foreground))] [--pill-fill:hsl(var(--foreground))] [--pill-fill-text:hsl(var(--background))]',
  'flex h-11 items-center rounded-full border border-border bg-[var(--pill-base)] px-1.5',
)

function pillClass(active: boolean) {
  return cn(
    'relative flex h-8 items-center gap-1.5 overflow-hidden rounded-full px-4 text-sm font-medium',
    'text-[color:var(--pill-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    active && 'text-[color:var(--pill-active-text)]',
  )
}

/** What sits inside a pill: the hover fill, the label and its hover copy, the active dot. */
function PillBody({
  label,
  active,
  leading,
  badge,
}: {
  label: string
  active: boolean
  leading?: ReactNode
  badge?: ReactNode
}) {
  return (
    <>
      <span
        data-pill-circle
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 z-[1] block rounded-full bg-[var(--pill-fill)] will-change-transform"
      />
      {leading && <span className="relative z-[2] flex">{leading}</span>}
      <span className="relative z-[2] inline-block overflow-hidden py-0.5 leading-5">
        <span data-pill-label className="relative inline-block will-change-transform">
          {label}
        </span>
        <span
          data-pill-label-hover
          aria-hidden
          className="absolute inset-x-0 top-0.5 inline-block text-center text-[color:var(--pill-fill-text)] will-change-transform"
        >
          {label}
        </span>
      </span>
      {badge && <span className="relative z-[2] flex">{badge}</span>}
      {active && (
        <span aria-hidden className="absolute bottom-1 left-1/2 z-[2] size-1 -translate-x-1/2 rounded-full bg-primary" />
      )}
    </>
  )
}

/** Pill-shaped route links, with the hover described at `usePillHover`. */
export function PillNav({ items, className, ease = 'power3.out' }: PillNavProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  usePillHover(rootRef, items.map((item) => item.to).join('|'), ease, true)

  return (
    <div ref={rootRef} className={cn(ROOT_CLASS, className)}>
      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} data-nav-pill className={({ isActive }) => pillClass(isActive)}>
              {({ isActive }) => <PillBody label={item.label} active={isActive} badge={item.badge} />}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type PillTabItem<T> = {
  value: T
  label: string
  /** Rendered before the label, e.g. a colour dot. */
  leading?: ReactNode
}

type PillTabsProps<T> = {
  items: readonly PillTabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label: string
  className?: string
  ease?: string
}

/**
 * The same pills as `PillNav`, as toggle buttons for a choice within a page
 * (the map's day picker) rather than links between routes. When the pills do
 * not fit they scroll sideways, with a small slider underneath.
 */
export function PillTabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
  className,
  ease = 'power3.out',
}: PillTabsProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const key = items.map((item) => item.value).join('|')
  usePillHover(rootRef, key, ease, false)

  // Bring the picked pill into view, e.g. a later day picked from its stop on the map.
  useEffect(() => {
    const root = rootRef.current
    const pill = root?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!root || !pill) return
    const [start, end] = [pill.offsetLeft, pill.offsetLeft + pill.offsetWidth]
    if (start < root.scrollLeft) root.scrollTo({ left: start - 8, behavior: 'smooth' })
    else if (end > root.scrollLeft + root.clientWidth) {
      root.scrollTo({ left: end - root.clientWidth + 8, behavior: 'smooth' })
    }
  }, [value, key])

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <div ref={rootRef} role="group" aria-label={label} className={cn(ROOT_CLASS, 'no-scrollbar overflow-x-auto', className)}>
        <ul className="m-0 flex list-none items-center gap-1 p-0">
          {items.map((item) => (
            <li key={item.value} className="shrink-0">
              <button
                type="button"
                data-nav-pill
                aria-pressed={item.value === value}
                onClick={() => onChange(item.value)}
                className={pillClass(item.value === value)}
              >
                <PillBody label={item.label} active={item.value === value} leading={item.leading} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ScrollSlider targetRef={rootRef} contentKey={key} />
    </div>
  )
}

/**
 * A thin slider under a sideways-scrolling row, standing in for the scrollbar
 * a rounded pill would clip. Drag the thumb, or click the track to jump there.
 * Shown only while the row overflows. Mouse users get it as the way to reach
 * hidden pills; touch users can also swipe the row itself.
 */
function ScrollSlider({ targetRef, contentKey }: { targetRef: RefObject<HTMLElement | null>; contentKey: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  // Thumb size and position, as fractions of the track; null while nothing overflows.
  const [thumb, setThumb] = useState<{ size: number; start: number } | null>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return
    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = target
      setThumb(
        scrollWidth > clientWidth + 1
          ? { size: clientWidth / scrollWidth, start: scrollLeft / scrollWidth }
          : null,
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(target)
    if (target.firstElementChild) observer.observe(target.firstElementChild)
    target.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      target.removeEventListener('scroll', update)
    }
  }, [targetRef, contentKey])

  if (!thumb) return null

  function scrollToPointer(clientX: number, grab: number) {
    const target = targetRef.current
    const track = trackRef.current?.getBoundingClientRect()
    if (!target || !track) return
    target.scrollLeft = ((clientX - track.left) / track.width - grab) * target.scrollWidth
  }

  return (
    <div
      ref={trackRef}
      aria-hidden
      className="relative mx-4 h-1.5 cursor-pointer touch-none rounded-full bg-[hsl(var(--card)/0.55)] shadow-sm"
      onPointerDown={(event) => {
        const track = event.currentTarget.getBoundingClientRect()
        const at = (event.clientX - track.left) / track.width
        // Grabbing the thumb keeps it under the pointer; clicking the track centres it there.
        const onThumb = at >= thumb.start && at <= thumb.start + thumb.size
        const grab = onThumb ? at - thumb.start : thumb.size / 2
        event.currentTarget.setPointerCapture(event.pointerId)
        scrollToPointer(event.clientX, grab)

        const trackEl = event.currentTarget
        const move = (e: PointerEvent) => scrollToPointer(e.clientX, grab)
        const up = () => {
          trackEl.removeEventListener('pointermove', move)
          trackEl.removeEventListener('pointerup', up)
          trackEl.removeEventListener('pointercancel', up)
        }
        trackEl.addEventListener('pointermove', move)
        trackEl.addEventListener('pointerup', up)
        trackEl.addEventListener('pointercancel', up)
      }}
    >
      <span
        className="absolute inset-y-0 rounded-full bg-[hsl(var(--foreground)/0.85)]"
        style={{ left: `${thumb.start * 100}%`, width: `${thumb.size * 100}%` }}
      />
    </div>
  )
}
