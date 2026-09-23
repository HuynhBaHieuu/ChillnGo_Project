import type * as React from 'react'

import { cn } from '@/lib/utils'

interface PageContainerProps extends React.ComponentProps<'div'> {
  /** Drop the max-width so a page can go edge to edge (e.g. Discover's map). */
  wide?: boolean
}

/**
 * The standard page wrapper.
 *
 * Top padding clears the fixed navbar; bottom padding clears the mobile bottom
 * nav. The landing page opts out of this and lays itself out full-bleed.
 */
export function PageContainer({ wide = false, className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-[hsl(var(--background))] pb-32 pt-32 text-foreground md:pb-20',
        className,
      )}
      {...props}
    >
      <div className={cn('mx-auto px-6', wide ? 'max-w-[110rem]' : 'max-w-7xl')}>
        {children}
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Page title block. Always the first-paint element, so it fades in. */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'animate-fade-rise mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
