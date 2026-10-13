import type * as React from 'react'

import { cn } from '@/lib/utils'

interface GlassCardProps extends React.ComponentProps<'div'> {
  /**
   * Render as a different element. A fixed list rather than any element type:
   * React Three Fiber adds its 3D elements to the JSX tag list, and a tag that
   * could be any of those types `children` as `never`.
   */
  as?: 'div' | 'section' | 'article' | 'aside' | 'nav' | 'header' | 'footer' | 'main'
  /** Lift on hover — for cards that are themselves links or buttons. */
  interactive?: boolean
}

/**
 * The app's default surface: a `.liquid-glass` pane with a rounded corner.
 *
 * Children are wrapped in a `relative z-[1]` layer so they always sit above the
 * gradient rim that `.liquid-glass::before` paints.
 */
export function GlassCard({
  as: Comp = 'div',
  interactive = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <Comp
      className={cn(
        'liquid-glass rounded-2xl',
        interactive && 'liquid-glass-interactive',
        className,
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </Comp>
  )
}
