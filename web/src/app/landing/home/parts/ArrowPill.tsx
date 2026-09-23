import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import type { ReactNode, SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'

import { gsap, useGSAP } from '@/app/landing/home/gsap'

/**
 * Solid forest pill for the home page's light sections, where a signal-yellow
 * CTA would sit on paper at 5.6:1 and lose to the display type beside it.
 *
 * On hover (time-based, not scroll) a round arrow badge grows out of the right
 * end: 0.35s power3.out in, 0.25s power2.in out.
 */
export function ArrowPill({ to, children }: { to: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const { contextSafe } = useGSAP({ scope: ref })

  const enter = contextSafe((event: SyntheticEvent<HTMLAnchorElement>) => {
    const vars = { duration: 0.35, ease: 'power3.out', overwrite: 'auto' as const }
    gsap.to(event.currentTarget, { paddingRight: 6, ...vars })
    gsap.to('[data-dot]', { width: 28, marginLeft: 10, scale: 1, ...vars })
    gsap.to('[data-arrow]', { x: 0, ...vars, delay: 0.05 })
    gsap.to('[data-label]', { x: -2, ...vars })
  })

  const leave = contextSafe((event: SyntheticEvent<HTMLAnchorElement>) => {
    const vars = { duration: 0.25, ease: 'power2.in', overwrite: 'auto' as const }
    gsap.to(event.currentTarget, { paddingRight: 20, ...vars })
    gsap.to('[data-dot]', { width: 0, marginLeft: 0, scale: 0, ...vars })
    gsap.to('[data-arrow]', { x: -6, ...vars })
    gsap.to('[data-label]', { x: 0, ...vars })
  })

  return (
    <Link
      ref={ref}
      to={to}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      className="inline-flex items-center rounded-full bg-foreground py-[0.4286rem] pl-[1rem] pr-[1rem] text-sm uppercase tracking-[0.02em] text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <span data-label className="inline-block py-1.5">
        {children}
      </span>
      <span
        data-dot
        className="grid h-7 w-0 shrink-0 scale-0 place-items-center overflow-hidden rounded-full bg-background text-foreground"
      >
        <ArrowRight data-arrow className="size-3.5 -translate-x-1.5" />
      </span>
    </Link>
  )
}
