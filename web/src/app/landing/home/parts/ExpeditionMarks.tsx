import { cn } from '@/lib/utils'

/** A loose pen loop under a heading. `pathLength=1` lets the CSS dash it in 0–1. */
export function Scribble({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 320 64" fill="none" className={cn('xp-scribble pointer-events-none absolute text-primary', className)}>
      <path
        d="M6 40c48-16 118-24 190-20 46 3 96 12 112 24 10 8-12 13-44 14-70 3-162-2-214-12"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Column guides: the page gutters, then the inner edge of every two-column
 * band of the 12-column grid (sixths of the content width, 50% among them).
 */
export function GridOverlay() {
  return (
    <div aria-hidden className="xp-grid">
      <div>
        <i style={{ left: '0.75em' }} />
        <i style={{ right: '0.75em' }} />
        {[1, 2, 3, 4, 5].map((k) => (
          <i key={k} className={cn(k % 2 === 1 && 'max-md:hidden')} style={{ left: `calc(0.75em + (100% - 1.5em) * ${k} / 6)` }} />
        ))}
      </div>
    </div>
  )
}
