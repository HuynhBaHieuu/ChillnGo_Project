import { ImagePlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckInDialog } from '@/features/checkin/CheckInDialog'
import type { CheckInStart } from '@/features/checkin/CheckInDialog'
import { cn } from '@/lib/utils'
import type { User } from '@/services/types'

/** `wideOnly`: hidden on phones, where the prompt needs the room. */
const SHORTCUTS: {
  label: string
  /** What the shortcut does, for screen readers and the hover tooltip. */
  hint: string
  start: CheckInStart
  icon: LucideIcon
  className: string
  wideOnly?: boolean
}[] = [
  { label: 'Ảnh', hint: 'Check-in: ảnh, cảm xúc và địa điểm', start: 'photos', icon: ImagePlus, className: 'text-emerald-600' },
]

/**
 * The bar at the top of the Newsfeed.
 *
 *   prompt pill  → the post editor: a full day-by-day trip itinerary
 *   Ảnh          → a check-in (photos, feeling or activity, place), with the
 *                  file picker opened right away
 */
export function PostComposer({ user }: { user: User }) {
  const [checkIn, setCheckIn] = useState<CheckInStart | null>(null)

  return (
    <GlassCard className="p-3 sm:p-4">
      {/* GlassCard wraps its children in a layer of its own, so the row lives here. */}
      <div className="flex items-center gap-3">
        <Link to={`/users/${user._id}`} aria-label="Trang cá nhân của bạn" className="shrink-0">
          <Avatar className="size-11">
            <AvatarImage src={user.avatarUrl} alt="" />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>

        <Link
          to="/posts/new"
          className="min-w-0 flex-1 truncate rounded-full bg-muted px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
        >
          <span className="sm:hidden">Bạn vừa đi đâu?</span>
          <span className="hidden sm:inline">{user.displayName} ơi, bạn vừa đi đâu thế?</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {SHORTCUTS.map(({ label, hint, start, icon: Icon, className, wideOnly }) => (
            <button
              key={label}
              type="button"
              onClick={() => setCheckIn(start)}
              aria-label={hint}
              title={hint}
              className={cn(
                'items-center gap-2 rounded-full p-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3',
                wideOnly ? 'hidden sm:flex' : 'flex',
              )}
            >
              <Icon className={cn('size-6', className)} aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <CheckInDialog
        open={checkIn !== null}
        onOpenChange={(open) => !open && setCheckIn(null)}
        user={user}
        start={checkIn ?? 'photos'}
      />
    </GlassCard>
  )
}
