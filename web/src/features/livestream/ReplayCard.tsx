import { Film, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveStats } from '@/features/livestream/LiveEnded'
import { formatDuration, formatStart } from '@/features/livestream/live-format'
import { relativeTime } from '@/lib/format'
import type { Livestream } from '@/services/livestream.service'

const AUDIENCE_LABEL: Record<Livestream['audience'], string | null> = {
  public: null,
  followers: 'Người theo dõi',
  private: 'Chỉ mình tôi',
}

/**
 * A stream that is over: when it ran, its numbers, and a way into the replay
 * (or the summary, when it was not recorded). `showHost` adds who streamed,
 * for lists that mix people (the Newsfeed, "Đang live").
 */
export function ReplayCard({ stream, showHost = false }: { stream: Livestream; showHost?: boolean }) {
  const href = `/live/${stream._id}`
  const replay = stream.recording.status === 'ready'
  const processing = stream.recording.status === 'processing' || stream.recording.status === 'recording'
  const audience = AUDIENCE_LABEL[stream.audience]

  return (
    <GlassCard as="article" interactive className="p-4 sm:p-5">
      {showHost && (
        <header className="mb-4 flex items-center gap-3 text-sm">
          <Link to={`/users/${stream.host._id}`} className="shrink-0">
            <Avatar className="size-10">
              <AvatarImage src={stream.host.avatarUrl} alt="" />
              <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <p className="min-w-0 leading-snug">
            <Link to={`/users/${stream.host._id}`} className="font-semibold hover:underline">
              {stream.host.displayName}
            </Link>{' '}
            <span className="text-muted-foreground">đã phát trực tiếp</span>
            <span className="block text-xs text-muted-foreground">{relativeTime(stream.endedAt ?? stream.startedAt)}</span>
          </p>
        </header>
      )}

      <Link to={href} className="flex flex-col gap-4 sm:flex-row" aria-label={`${replay ? 'Xem lại' : 'Xem tổng kết'}: ${stream.title}`}>
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border-2 border-foreground bg-foreground sm:w-56">
          <img src={stream.host.avatarUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-xl" />
          <span className="absolute inset-0 grid place-items-center text-background">
            {replay ? (
              <span className="grid size-12 place-items-center rounded-full bg-rose-600 text-white shadow-lg">
                <Play className="ml-0.5 size-5" aria-hidden />
              </span>
            ) : (
              <Film className="size-7 opacity-80" aria-hidden />
            )}
          </span>
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {formatDuration(stream.recording.durationSec || stream.durationSec)}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatStart(stream.startedAt)}</span>
            {audience && <span className="rounded-full bg-muted px-2 py-0.5">{audience}</span>}
            {replay && <span className="rounded-full bg-rose-600/10 px-2 py-0.5 font-semibold text-rose-700">Xem lại</span>}
            {processing && <span className="rounded-full bg-muted px-2 py-0.5">Bản ghi đang xử lý</span>}
          </div>
          <h3 className="font-display text-xl leading-tight">{stream.title}</h3>
          <LiveStats stream={stream} compactView />
        </div>
      </Link>
    </GlassCard>
  )
}
