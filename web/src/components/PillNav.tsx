import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useRef, type ReactNode } from 'react'
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
 * Pill-shaped route links. On hover a circle rises from below to fill the pill
 * while the label slides up and a dark copy slides in behind it.
 *
 * Colours are CSS variables on the root, defaulting to the theme tokens, so a
 * caller can re-skin it through `className` without new props.
 */
export function PillNav({ items, className, ease = 'power3.out' }: PillNavProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const routes = items.map((item) => item.to).join('|')

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
          const { width: w, height: h } = pill.getBoundingClientRect()
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

      if (!entrancePlayed && !reduceMotion) {
        gsap.from(root.querySelectorAll('li'), {
          opacity: 0,
          x: -12,
          duration: 0.6,
          stagger: 0.05,
          ease: 'power2.out',
          delay: 0.2,
        })
      }
      entrancePlayed = true

      return () => cleanups.forEach((cleanup) => cleanup())
    },
    { scope: rootRef, dependencies: [routes, ease] },
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        '[--pill-base:hsl(var(--card))] [--pill-text:hsl(var(--muted-foreground))]',
        '[--pill-active-text:hsl(var(--foreground))] [--pill-fill:hsl(var(--foreground))] [--pill-fill-text:hsl(var(--background))]',
        'flex h-11 items-center rounded-full border border-border bg-[var(--pill-base)] px-1.5',
        className,
      )}
    >
      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              data-nav-pill
              className={({ isActive }) =>
                cn(
                  'relative flex h-8 items-center gap-1.5 overflow-hidden rounded-full px-4 text-sm font-medium',
                  'text-[color:var(--pill-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isActive && 'text-[color:var(--pill-active-text)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    data-pill-circle
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-1/2 z-[1] block rounded-full bg-[var(--pill-fill)] will-change-transform"
                  />
                  <span className="relative z-[2] inline-block overflow-hidden py-0.5 leading-5">
                    <span data-pill-label className="relative inline-block will-change-transform">
                      {item.label}
                    </span>
                    <span
                      data-pill-label-hover
                      aria-hidden
                      className="absolute inset-x-0 top-0.5 inline-block text-center text-[color:var(--pill-fill-text)] will-change-transform"
                    >
                      {item.label}
                    </span>
                  </span>
                  {item.badge && <span className="relative z-[2] flex">{item.badge}</span>}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute bottom-1 left-1/2 z-[2] size-1 -translate-x-1/2 rounded-full bg-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
