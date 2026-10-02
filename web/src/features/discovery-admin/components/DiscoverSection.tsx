import type * as React from 'react'

interface DiscoverSectionProps {
  title: string
  description?: string
  /** Sits at the right of the heading row, e.g. a "clear filters" link. */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** One Discover band: a heading with an optional one-line description over its content. */
export function DiscoverSection({
  title,
  description,
  action,
  className,
  children,
}: DiscoverSectionProps) {
  return (
    <section className={className}>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
            {title}
          </h2>
          {description && (
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
