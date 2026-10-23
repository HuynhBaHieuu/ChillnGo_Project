import { Eye } from 'lucide-react'
import type * as React from 'react'

import { formatClock, useElapsed } from '@/features/livestream/live-format'
import { cn } from '@/lib/utils'
import { localeTag, t } from '@/i18n'

/**
 * "● LIVE 12:34": the badge with the time since the stream began, ticking.
 * `baseSec` seconds were measured at `baseAt` (see useElapsed).
 */
export function LiveClock({ baseSec, baseAt, className }: { baseSec: number; baseAt: number; className?: string }) {
  const elapsed = useElapsed(baseSec, baseAt)
  return (
    <LiveBadge className={className}>
      <span className="tabular-nums" aria-label={t('Đã phát {time}', { time: formatClock(elapsed) })}>
        {formatClock(elapsed)}
      </span>
    </LiveBadge>
  )
}

/** The red "● LIVE" pill. The dot pulses; the word stays still. */
export function LiveBadge({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm',
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      Live
      {children}
    </span>
  )
}

/** "👁 12 người đang xem". Re-keyed on change so the number fades in. */
export function ViewerCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', className)} aria-live="polite">
      <Eye className="size-3.5" aria-hidden />
      <span key={count} className="animate-fade-rise tabular-nums">
        {count.toLocaleString(localeTag())}
      </span>
      <span>{t('người đang xem')}</span>
    </span>
  )
}
