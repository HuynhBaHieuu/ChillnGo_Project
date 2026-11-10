import { Crown } from 'lucide-react'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * The crown shown next to a Premium member's name. Renders nothing for
 * everyone else, so callers can drop it in unconditionally.
 */
export function PremiumBadge({ user, className }: { user: { isPremium?: boolean } | null | undefined; className?: string }) {
  if (!user?.isPremium) return null
  return (
    <span
      title={t('Thành viên Premium')}
      aria-label={t('Thành viên Premium')}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-amber-400/90 p-0.5 align-middle text-amber-950',
        className,
      )}
    >
      <Crown aria-hidden className="size-3" strokeWidth={2.5} />
    </span>
  )
}
