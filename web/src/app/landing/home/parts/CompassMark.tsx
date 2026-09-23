import type * as React from 'react'

/** A four-point compass star — the home page's scanner mark. */
export function CompassMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="-12 -12 24 24" aria-hidden {...props}>
      <path d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="currentColor" />
    </svg>
  )
}
