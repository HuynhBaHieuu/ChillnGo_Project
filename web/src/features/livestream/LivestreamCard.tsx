import { Check, Link2, MessageCircle, Radio } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveBadge, LiveClock, ViewerCount } from '@/features/livestream/LiveBadge'
import { LivePreview } from '@/features/livestream/LivePreview'
import { relativeTime } from '@/lib/format'
import type { Livestream } from '@/services/livestream.service'

/**
 * A stream that is live right now, at the top of the Newsfeed. While the card
 * is on screen it plays a muted, low-quality preview of the host's camera
 * (hidden and uncounted, see LivePreview); until then, and if that fails, a
 * poster made from the host's photo.
 */
export function LivestreamCard({ stream }: { stream: Livestream }) {
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
    <GlassCard as="article" className="p-4 sm:p-5">
      <div className="space-y-4">
        <header className="flex items-start gap-3">
          <Link to={`/users/${stream.host._id}`} className="relative shrink-0">
            <Avatar className="size-11 ring-2 ring-rose-600 ring-offset-2 ring-offset-card">
              <AvatarImage src={stream.host.avatarUrl} alt="" />
              <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p>
              <Link to={`/users/${stream.host._id}`} className="font-semibold hover:underline">
                {stream.host.displayName}
              </Link>{' '}
              <span className="text-muted-foreground">đang phát trực tiếp</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <LiveBadge />
              <span>Bắt đầu {relativeTime(stream.startedAt)}</span>
            </p>
          </div>
        </header>

        <h3 className="font-display text-xl leading-tight">“{stream.title}”</h3>
        {stream.description && <p className="line-clamp-2 text-sm text-muted-foreground">{stream.description}</p>}

        <Link
          to={href}
          className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border-2 border-foreground bg-foreground"
          aria-label={`Xem livestream ${stream.title}`}
        >
          <img
            src={stream.host.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
          />
          <div className="relative flex flex-col items-center gap-3 text-center text-background">
            <span className="grid size-16 place-items-center rounded-full bg-rose-600 text-white shadow-lg transition-transform group-hover:scale-105">
              <Radio className="size-7" aria-hidden />
            </span>
            <span className="text-sm font-semibold">Đang phát trực tiếp · bấm để xem</span>
          </div>
          <LivePreview streamId={stream._id} hostId={stream.host._id} />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Bấm để xem
          </span>
          <div className="absolute left-3 top-3 flex items-center gap-2 text-white">
            <LiveClock baseSec={0} baseAt={Date.parse(stream.startedAt)} />
            <ViewerCount count={stream.viewerCount} className="rounded-full bg-black/40 px-2.5 py-1" />
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Link
              to={href}
              aria-label="Bình luận trong livestream"
              title="Bình luận trong livestream"
              className="grid size-10 place-items-center rounded-full hover:bg-muted hover:text-foreground"
            >
              <MessageCircle className="size-5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => void copyLink()}
              aria-label="Sao chép liên kết livestream"
              title={copied ? 'Đã sao chép liên kết' : 'Sao chép liên kết'}
              className="grid size-10 place-items-center rounded-full hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="size-5 text-emerald-600" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
            </button>
          </div>
          <GlassButton asChild tone="sunset" size="md">
            <Link to={href}>Xem livestream</Link>
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
