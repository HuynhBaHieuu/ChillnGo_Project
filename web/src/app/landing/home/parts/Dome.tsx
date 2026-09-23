import { DOME_FROM } from '@/app/landing/home/parts/domeTween'
import { cn } from '@/lib/utils'

/**
 * The "dome" section transition: a solid shape that rises from the bottom edge
 * and floods the viewport with the next section's colour.
 *
 * It is a clipped solid fill, not a gradient (the design system forbids radial
 * gradients). The soft edge comes from blurring the *wrapper*: CSS applies
 * `filter` before `clip-path` on the same element, so blurring the clipped
 * element itself would leave a hard edge. The wrapper overhangs the viewport by
 * 96px on every side — a 28px blur fades out over about 3σ ≈ 84px, and a
 * percentage overhang is too thin on phones — so that fade never shows at the
 * screen edges.
 */

export function Dome({ tone }: { tone: 'paper' | 'ground' }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-24 z-30 motion-reduce:hidden"
      style={{ filter: 'blur(28px)' }}
    >
      <div
        data-dome
        className={cn('absolute inset-0', tone === 'paper' ? 'bg-paper' : 'bg-background')}
        style={{ clipPath: DOME_FROM }}
      />
    </div>
  )
}
