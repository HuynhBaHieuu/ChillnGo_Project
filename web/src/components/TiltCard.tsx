import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useRef } from 'react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

/** Only where there is a real mouse and motion is welcome. */
const TILT_MEDIA = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

/** Gap between the cursor and the caption, in px. */
const CAPTION_OFFSET = 14

interface TiltCardProps {
  children: React.ReactNode
  /** Short text in a tooltip that trails the cursor. Omit for none. */
  caption?: string
  /** Tilt in degrees when the cursor is at the card's edge. */
  rotateAmplitude?: number
  /** Scale while hovered. */
  scaleOnHover?: number
  className?: string
}

/**
 * A card that tilts toward the cursor in 3D, with an optional caption that
 * trails the pointer — the TiltedCard pattern, driven by GSAP rather than
 * framer-motion since GSAP already runs the app's motion.
 *
 * The tilt sits on a layer around the child, not on the child itself:
 * `.liquid-glass-interactive` transitions the card's own `transform` on hover,
 * and an inline GSAP transform on the same element would override it.
 *
 * Touch screens and reduced motion get the child as-is.
 */
export function TiltCard({
  children,
  caption,
  rotateAmplitude = 8,
  scaleOnHover = 1.03,
  className,
}: TiltCardProps) {
  const root = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(TILT_MEDIA, () => {
        const el = root.current!
        const follow = { duration: 0.6, ease: 'power3.out' }
        const rotateX = gsap.quickTo(layer.current, 'rotationX', follow)
        const rotateY = gsap.quickTo(layer.current, 'rotationY', follow)
        // quickTo takes one real property; `scale` is an alias GSAP splits up.
        const scaleX = gsap.quickTo(layer.current, 'scaleX', follow)
        const scaleY = gsap.quickTo(layer.current, 'scaleY', follow)
        const scale = (value: number) => {
          scaleX(value)
          scaleY(value)
        }

        const tipEl = tip.current
        const tipX = tipEl && gsap.quickSetter(tipEl, 'x', 'px')
        const tipY = tipEl && gsap.quickSetter(tipEl, 'y', 'px')
        const tipRotate = tipEl && gsap.quickTo(tipEl, 'rotation', { duration: 0.3, ease: 'power3.out' })
        const clampSwing = gsap.utils.clamp(-12, 12)
        let lastY = 0

        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          const rect = el.getBoundingClientRect()
          const localX = e.clientX - rect.left
          const localY = e.clientY - rect.top
          const offsetX = localX - rect.width / 2
          const offsetY = localY - rect.height / 2

          rotateX((offsetY / (rect.height / 2)) * -rotateAmplitude)
          rotateY((offsetX / (rect.width / 2)) * rotateAmplitude)

          if (tipEl && tipX && tipY && tipRotate) {
            // Past the middle, hang the caption on the cursor's left so the
            // right-hand column never pushes it off the page.
            const flip = offsetX > 0 ? tipEl.offsetWidth + CAPTION_OFFSET * 2 : 0
            tipX(localX + CAPTION_OFFSET - flip)
            tipY(localY + CAPTION_OFFSET)
            // The caption swings with vertical speed, like a hanging label.
            tipRotate(clampSwing(-(offsetY - lastY) * 0.6))
          }
          lastY = offsetY
        }

        const onEnter = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          scale(scaleOnHover)
          if (tipEl) gsap.to(tipEl, { autoAlpha: 1, duration: 0.2, overwrite: 'auto' })
        }

        const onLeave = () => {
          rotateX(0)
          rotateY(0)
          scale(1)
          if (tipEl) {
            tipRotate?.(0)
            gsap.to(tipEl, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' })
          }
        }

        el.addEventListener('pointermove', onMove)
        el.addEventListener('pointerenter', onEnter)
        el.addEventListener('pointerleave', onLeave)
        return () => {
          el.removeEventListener('pointermove', onMove)
          el.removeEventListener('pointerenter', onEnter)
          el.removeEventListener('pointerleave', onLeave)
        }
      })
    },
    { scope: root, dependencies: [rotateAmplitude, scaleOnHover], revertOnUpdate: true },
  )

  return (
    // z-10 on hover: the scaled card and its caption paint over their neighbours.
    <div ref={root} className={cn('relative [perspective:1000px] hover:z-10', className)}>
      <div ref={layer} className="h-full">
        {children}
      </div>
      {caption && (
        <span
          ref={tip}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 z-20 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground opacity-0 shadow-lg"
        >
          {caption}
        </span>
      )}
    </div>
  )
}
