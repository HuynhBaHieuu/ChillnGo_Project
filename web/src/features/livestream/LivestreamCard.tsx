import { Check, Link2, MessageCircle, Radio } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveBadge, LiveClock, ViewerCount } from '@/features/livestream/LiveBadge'
import { LivePreview } from '@/features/livestream/LivePreview'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Livestream } from '@/services/livestream.service'
import { t } from '@/i18n'

/**
 * A stream that is live right now, at the top of the Newsfeed. While the card
 * is on screen it plays a muted, low-quality preview of the host's camera
 * (hidden and uncounted, see LivePreview); until then, and if that fails, a
 * poster made from the host's photo. `featured` is the Newsfeed's treatment:
 * a raised block with a coral rim (styles/np-surfaces.css).
 */
export function LivestreamCard({ stream, featured = false }: { stream: Livestream; featured?: boolean }) {
  const href = `/live/${stream._id}`
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: nothing useful to do.
    }
  }

  return (
    <GlassCard as="article" className={cn('p-4 sm:p-5', featured && 'np-featured np-live')}>
      <div className="space-y-4">
        <header className="flex items-start gap-3">
          <Link to={`/users/${stream.host._id}`} className="relative shrink-0">
            <Avatar
              className={cn(
                'size-11 ring-2 ring-offset-2',
                featured ? 'ring-np-social ring-offset-np-raised' : 'ring-rose-600 ring-offset-card',
              )}
            >
              <AvatarImage src={stream.host.avatarUrl} alt="" />
              <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p>
              <Link to={`/users/${stream.host._id}`} className={cn('font-semibold hover:underline', featured && 'text-np-cream')}>
                {stream.host.displayName}
              </Link>{' '}
              <span className="text-muted-foreground">{t('đang phát trực tiếp')}</span>
            </p>
            <p className={cn('mt-1 flex flex-wrap items-center gap-2 text-muted-foreground', featured ? 'text-[13px]' : 'text-xs')}>
              <LiveBadge className={featured ? 'np-glow-social bg-np-social text-np-ink' : undefined} />
              <span>{t('Bắt đầu {time}', { time: relativeTime(stream.startedAt) })}</span>
            </p>
          </div>
        </header>

        <h3 className={cn('font-display leading-tight', featured ? 'text-xl sm:text-2xl' : 'text-xl')}>“{stream.title}”</h3>
        {stream.description && <p className="line-clamp-2 text-sm text-muted-foreground">{stream.description}</p>}

        <Link
          to={href}
          className={cn(
            'group relative flex aspect-video items-center justify-center overflow-hidden',
            featured ? 'np-media' : 'rounded-2xl border-2 border-foreground bg-foreground',
          )}
          aria-label={`Xem livestream ${stream.title}`}
        >
          <img
            src={stream.host.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
          />
          {featured && <span aria-hidden className="absolute inset-0 bg-np-canopy/45" />}
          <div className={cn('relative flex flex-col items-center gap-3 text-center', featured ? 'text-np-cream' : 'text-background')}>
            <span
              className={cn(
                'grid size-16 place-items-center rounded-full transition-transform group-hover:scale-105 motion-reduce:transition-none',
                featured ? 'np-glow-social bg-np-social text-np-ink' : 'bg-rose-600 text-white shadow-lg',
              )}
            >
              <Radio className="size-7" aria-hidden />
            </span>
            <span className="text-sm font-semibold">{t('Đang phát trực tiếp · bấm để xem')}</span>
          </div>
          <LivePreview streamId={stream._id} hostId={stream.host._id} />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {t('Bấm để xem')}
          </span>
          <div className="absolute left-3 top-3 flex items-center gap-2 text-white">
            <LiveClock
              baseSec={0}
              baseAt={Date.parse(stream.startedAt)}
              className={featured ? 'np-glow-social bg-np-social text-np-ink' : undefined}
            />
            <ViewerCount count={stream.viewerCount} className="rounded-full bg-black/40 px-2.5 py-1" />
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Link
              to={href}
              aria-label={t('Bình luận trong livestream')}
              title={t('Bình luận trong livestream')}
              className="grid size-10 place-items-center rounded-full hover:bg-muted hover:text-foreground"
            >
              <MessageCircle className="size-5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => void copyLink()}
              aria-label={t('Sao chép liên kết livestream')}
              title={copied ? t('Đã sao chép liên kết') : t('Sao chép liên kết')}
              className="grid size-10 place-items-center rounded-full hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="size-5 text-emerald-600" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
            </button>
          </div>
          <GlassButton asChild tone="sunset" size="md">
            <Link to={href}>{t('Xem livestream')}</Link>
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
