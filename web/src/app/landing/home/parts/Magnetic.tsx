import { useRef } from 'react'
import type { ReactNode } from 'react'

import { gsap, useGSAP } from '@/app/landing/home/gsap'
import { cn } from '@/lib/utils'

/** Only where there is a real mouse and motion is welcome. */
const MAGNET_MEDIA = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

interface MagneticProps {
  children: ReactNode
  /** How far the child follows the cursor, as a fraction of the cursor's offset. */
  strength?: number
  /** Pull radius in px, measured from the child's centre. */
  radius?: number
  className?: string
}

/**
 * Pulls its child toward the cursor while the cursor is near, and lets it
 * settle back when it leaves. The pull sits on this wrapper, never on the
 * child, so the child's own CSS load-in animation keeps its transform.
 */
export function Magnetic({ children, strength = 0.3, radius = 160, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MAGNET_MEDIA, () => {
        const el = ref.current!
        const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
        const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })

        const onMove = (e: PointerEvent) => {
          const rect = el.getBoundingClientRect()
          // The rect includes the current pull; measure from the resting centre.
          const cx = rect.left + rect.width / 2 - (gsap.getProperty(el, 'x') as number)
          const cy = rect.top + rect.height / 2 - (gsap.getProperty(el, 'y') as number)
          const dx = e.clientX - cx
          const dy = e.clientY - cy
          const near = Math.hypot(dx, dy) < radius
          x(near ? dx * strength : 0)
          y(near ? dy * strength : 0)
        }

        window.addEventListener('pointermove', onMove, { passive: true })
        return () => window.removeEventListener('pointermove', onMove)
      })
    },
    { scope: ref, dependencies: [strength, radius], revertOnUpdate: true },
  )

  return (
    <div ref={ref} className={cn('inline-block', className)}>
      {children}
    </div>
  )
}
