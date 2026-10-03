import { Film, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveStats } from '@/features/livestream/LiveEnded'
import { openingFrame } from '@/features/livestream/frames'
import { formatDuration, formatStart } from '@/features/livestream/live-format'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Livestream } from '@/services/livestream.service'

const AUDIENCE_LABEL: Record<Livestream['audience'], string | null> = {
  public: null,
  followers: 'Người theo dõi',
  private: 'Chỉ mình tôi',
}

/**
 * A stream that is over: when it ran, its numbers, and a way into the replay
 * (or the summary, when it was not recorded). `showHost` adds who streamed,
 * for lists that mix people (the Newsfeed, "Đang live"). `featured` is the
 * Newsfeed's treatment: a raised content block (styles/np-surfaces.css).
 */
export function ReplayCard({
  stream,
  showHost = false,
  featured = false,
}: {
  stream: Livestream
  showHost?: boolean
  featured?: boolean
}) {
  const href = `/live/${stream._id}`
  const replay = stream.recording.status === 'ready'
  const processing = stream.recording.status === 'processing' || stream.recording.status === 'recording'
  const audience = AUDIENCE_LABEL[stream.audience]

  return (
    <GlassCard as="article" interactive className={cn('p-4 sm:p-5', featured && 'np-featured')}>
      {showHost && (
        <header className="mb-4 flex items-center gap-3 text-sm">
          <Link to={`/users/${stream.host._id}`} className="shrink-0">
            <Avatar className={cn('size-10', featured && 'ring-2 ring-np-social/60 ring-offset-2 ring-offset-np-raised')}>
              <AvatarImage src={stream.host.avatarUrl} alt="" />
              <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <p className="min-w-0 leading-snug">
            <Link to={`/users/${stream.host._id}`} className={cn('font-semibold hover:underline', featured && 'text-np-cream')}>
              {stream.host.displayName}
            </Link>{' '}
            <span className="text-muted-foreground">đã phát trực tiếp</span>
            <span className={cn('block text-muted-foreground', featured ? 'mt-0.5 text-[13px]' : 'text-xs')}>{relativeTime(stream.endedAt ?? stream.startedAt)}</span>
          </p>
        </header>
      )}

      <Link to={href} className={cn('flex flex-col gap-4 sm:flex-row', featured && 'group sm:gap-5')} aria-label={`${replay ? 'Xem lại' : 'Xem tổng kết'}: ${stream.title}`}>
        <div
          className={cn(
            'relative aspect-video w-full shrink-0 overflow-hidden',
            featured ? 'np-media sm:w-60 lg:w-64' : 'rounded-xl border-2 border-foreground bg-foreground sm:w-56',
          )}
        >
          {stream.thumbnailUrl ? (
            // The cover the host chose: shown as it is, with just enough shade under the play button and the length.
            <>
              <img src={stream.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </>
          ) : (
            <>
              <img
                src={stream.host.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className={cn('absolute inset-0 size-full scale-110 object-cover blur-xl', featured ? 'opacity-55' : 'opacity-40')}
              />
              {/* A green scrim, so the blurred poster warms towards the palette instead of going grey. */}
              {featured && <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-np-canopy/85 via-np-canopy/35 to-transparent" />}
              {/* No cover chosen: the replay's opening frame, over the blurred photo until it arrives. */}
              {replay && stream.recording.url && <FirstFrame url={stream.recording.url} />}
            </>
          )}
          <span className={cn('absolute inset-0 grid place-items-center', featured ? 'text-np-cream' : 'text-background')}>
            {replay ? (
              <span
                className={cn(
                  'grid size-12 place-items-center rounded-full',
                  featured
                    ? 'np-glow-social bg-np-social text-np-ink transition-transform group-hover:scale-105 motion-reduce:transition-none'
                    : 'bg-rose-600 text-white shadow-lg',
                )}
              >
                <Play className="ml-0.5 size-5" aria-hidden />
              </span>
            ) : (
              <Film className="size-7 opacity-80" aria-hidden />
            )}
          </span>
          <span
            className={cn(
              'absolute bottom-2 right-2 py-0.5 text-[11px] font-semibold tabular-nums',
              featured ? 'rounded-full bg-np-canopy/75 px-2 text-np-cream' : 'rounded bg-black/60 px-1.5 text-white',
            )}
          >
            {formatDuration(stream.recording.durationSec || stream.durationSec)}
          </span>
        </div>

        <div className={cn('min-w-0 flex-1', featured ? 'flex flex-col gap-3' : 'space-y-2')}>
          <div className={cn('flex flex-wrap items-center gap-2 text-muted-foreground', featured ? 'text-[13px]' : 'text-xs')}>
            {featured && replay && (
              <span className="np-replay-status">
                <Play className="size-3 fill-current" aria-hidden />
                Xem lại
              </span>
            )}
            <span>{formatStart(stream.startedAt)}</span>
            {audience && <span className="rounded-full bg-muted px-2 py-0.5">{audience}</span>}
            {!featured && replay && <span className="rounded-full bg-rose-600/10 px-2 py-0.5 font-semibold text-rose-700">Xem lại</span>}
            {processing && <span className="rounded-full bg-muted px-2 py-0.5">Bản ghi đang xử lý</span>}
          </div>
          <h3 className={cn('font-display leading-tight', featured ? 'text-xl sm:text-2xl' : 'text-xl')}>{stream.title}</h3>
          {featured ? <LiveStats stream={stream} featured /> : <LiveStats stream={stream} compactView />}
        </div>
      </Link>
    </GlassCard>
  )
}

/**
 * The replay's opening picture (frames.ts: its first frame that is not
 * black), fading in over the blurred photo. Only looked for once the card
 * scrolls near the screen.
 */
function FirstFrame({ url }: { url: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  const [frame, setFrame] = useState<string | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el || near) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let cancelled = false
    void openingFrame(url).then((src) => {
      if (!cancelled) setFrame(src)
    })
    return () => {
      cancelled = true
    }
  }, [near, url])

  return (
    <span ref={box} aria-hidden className={cn('absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none', frame ? 'opacity-100' : 'opacity-0')}>
      {frame && <img src={frame} alt="" className="size-full object-cover" />}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
    </span>
  )
}
