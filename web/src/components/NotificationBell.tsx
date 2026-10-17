import { Bell, Bookmark, Copy, Heart, MessageCircle, Radio, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkNotificationsRead, useNotifications } from '@/features/social/hooks'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/services/types'

const ICONS: Record<NotificationType, LucideIcon> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  clone: Copy,
  bookmark: Bookmark,
  system: Bell,
  live: Radio,
}

/** Where a notification leads: the stream, the post (its comments, for a comment), or the person who followed you. */
function targetOf(n: { livestreamId?: string | null; postId: string | null; type: NotificationType; actorId: string | null }): string | null {
  if (n.livestreamId) return `/live/${n.livestreamId}`
  if (n.postId) return n.type === 'comment' ? `/posts/${n.postId}#comments` : `/posts/${n.postId}`
  if (n.type === 'follow' && n.actorId) return `/users/${n.actorId}`
  return null
}

export function NotificationBell() {
  const { data: notifications, isLoading } = useNotifications()
  const markRead = useMarkNotificationsRead()
  // Controlled, so following a notification's link also closes the menu.
  const [open, setOpen] = useState(false)

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && unreadCount > 0) markRead.mutate()
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'
          }
          className="liquid-glass liquid-glass-interactive relative flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Bell className="relative z-[1] size-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-2 top-2 z-[2] size-2 rounded-full bg-white ring-2 ring-[hsl(var(--background))]"
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-display text-lg tracking-tight">Thông báo</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} mới</span>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto pb-2">
          {isLoading && (
            <div className="space-y-3 px-4 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && notifications?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Chưa có thông báo nào.
            </p>
          )}

          {notifications?.map((notification) => {
            const Icon = ICONS[notification.type]
            const body = (
              <div
                className={cn(
                  'flex gap-3 px-4 py-3 transition-colors hover:bg-white/5',
                  !notification.read && 'bg-white/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                    notification.type === 'live' ? 'bg-rose-600 text-white' : 'bg-white/10',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    {notification.actor && (
                      <span className="font-medium">
                        {notification.actor.displayName}{' '}
                      </span>
                    )}
                    <span className="text-muted-foreground">{notification.message}</span>
                  </p>
                  <time
                    dateTime={notification.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {relativeTime(notification.createdAt)}
                  </time>
                </div>
              </div>
            )

            const target = targetOf(notification)
            return target ? (
              <Link key={notification._id} to={target} onClick={() => setOpen(false)} className="block">
                {body}
              </Link>
            ) : (
              <div key={notification._id}>{body}</div>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
