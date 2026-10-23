import { ImagePlus, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckInDialog } from '@/features/checkin/CheckInDialog'
import { LivestreamSetupDialog } from '@/features/livestream/LivestreamSetupDialog'
import type { CheckInStart } from '@/features/checkin/CheckInDialog'
import { t, translatedList } from '@/i18n'
import { cn } from '@/lib/utils'
import type { User } from '@/services/types'

/** `wideOnly`: hidden on phones, where the prompt needs the room. */
const SHORTCUTS: {
  label: string
  /** What the shortcut does, for screen readers and the hover tooltip. */
  hint: string
  start: CheckInStart
  icon: LucideIcon
  /** The chip's tint — see `.np-chip-*` in styles/np-surfaces.css. */
  className: string
  wideOnly?: boolean
}[] = translatedList([
  { label: 'Ảnh', hint: 'Check-in: ảnh, cảm xúc và địa điểm', start: 'photos', icon: ImagePlus, className: 'np-chip-photo' },
], ['label', 'hint'])

/**
 * The bar at the top of the Newsfeed.
 *
 *   prompt pill  → the post editor: a full day-by-day trip itinerary
 *   Ảnh          → a check-in (photos, feeling or activity, place), with the
 *                  file picker opened right away
 *   Livestream   → camera check, then a live broadcast
 */
export function PostComposer({ user }: { user: User }) {
  const [checkIn, setCheckIn] = useState<CheckInStart | null>(null)
  const [goingLive, setGoingLive] = useState(false)

  return (
    <GlassCard className="np-surface p-3 sm:p-4">
      {/* GlassCard wraps its children in a layer of its own, so the row lives here. */}
      <div className="flex items-center gap-3">
        <Link to={`/users/${user._id}`} aria-label={t('Trang cá nhân của bạn')} className="shrink-0">
          <Avatar className="size-11 ring-2 ring-np-beige/15">
            <AvatarImage src={user.avatarUrl} alt="" />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>

        <Link
          to="/posts/new"
          className="np-well np-prompt min-w-0 flex-1 truncate rounded-full px-4 py-3 text-sm text-np-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
        >
          <span className="sm:hidden">{t('Bạn vừa đi đâu?')}</span>
          <span className="hidden sm:inline">{t('{name} ơi, bạn vừa đi đâu thế?', { name: user.displayName })}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {SHORTCUTS.map(({ label, hint, start, icon: Icon, className, wideOnly }) => (
            <button
              key={label}
              type="button"
              onClick={() => setCheckIn(start)}
              aria-label={hint}
              title={hint}
              className={cn(
                'np-chip justify-center max-sm:w-11 max-sm:px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className,
                wideOnly ? 'hidden sm:inline-flex' : 'inline-flex',
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGoingLive(true)}
            aria-label={t('Phát trực tiếp')}
            title={t('Phát trực tiếp')}
            className="np-chip np-chip-live justify-center max-sm:w-11 max-sm:px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Video className="size-5" aria-hidden />
            <span className="hidden sm:inline">{t('Livestream')}</span>
          </button>
        </div>
      </div>

      <CheckInDialog
        open={checkIn !== null}
        onOpenChange={(open) => !open && setCheckIn(null)}
        user={user}
        start={checkIn ?? 'photos'}
      />
      <LivestreamSetupDialog open={goingLive} onOpenChange={setGoingLive} user={user} />
    </GlassCard>
  )
}
