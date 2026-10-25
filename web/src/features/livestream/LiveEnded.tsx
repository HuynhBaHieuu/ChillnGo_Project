import { useQuery } from '@tanstack/react-query'
import { Clock, Eye, Film, ImageIcon, Loader2, MessageCircle, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LiveComments } from '@/features/livestream/LiveComments'
import { openingFrame } from '@/features/livestream/frames'
import { REACTIONS, compact, formatDuration, formatStart, totalReactions } from '@/features/livestream/live-format'
import { ThumbnailPicker } from '@/features/livestream/ThumbnailPicker'
import { FollowButton } from '@/features/social/components/FollowButton'
import { cn } from '@/lib/utils'
import { livestreamService } from '@/services'
import { REACTION_KINDS } from '@/services/livestream.service'
import type { Livestream } from '@/services/livestream.service'
import { useAuthStore } from '@/store'
import { t } from '@/i18n'

/**
 * /live/:id once the stream is over: the replay when there is one, the
 * statistics, and the comments. The host sees the same page as their
 * end-of-stream summary.
 */
export function LiveEnded({ initial }: { initial: Livestream }) {
  const me = useAuthStore((s) => s.user)
  const isHost = me?._id === initial.host._id
  const [pickingThumbnail, setPickingThumbnail] = useState(false)

  // Until the recording is ready (or has failed), look again every 15 seconds.
  const { data: stream = initial } = useQuery({
    queryKey: ['livestream', initial._id],
    queryFn: () => livestreamService.getLivestream(initial._id),
    initialData: initial,
    refetchInterval: (query) => {
      const status = query.state.data?.recording.status
      return status === 'processing' || status === 'recording' ? 15_000 : false
    },
  })
  const comments = useQuery({
    queryKey: ['livestream-comments', stream._id, 'all'],
    queryFn: () => livestreamService.listComments(stream._id, 200),
  })

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0 space-y-5">
        <Replay stream={stream} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link to={`/users/${stream.host._id}`} className="shrink-0">
              <Avatar className="size-12">
                <AvatarImage src={stream.host.avatarUrl} alt="" />
                <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-2xl leading-tight sm:text-3xl">{stream.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link to={`/users/${stream.host._id}`} className="font-semibold text-foreground hover:underline">
                  {stream.host.displayName}
                </Link>{' '}
                · {t('phát lúc {time}', { time: formatStart(stream.startedAt) })}
              </p>
              {stream.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{stream.description}</p>}
            </div>
          </div>
          {me && !isHost && (
            <div className="shrink-0">
              <FollowButton userId={stream.host._id} />
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border-2 border-foreground bg-card p-4 sm:p-5">
          <h2 className="font-display text-xl">{isHost ? t('Tổng kết buổi phát của bạn') : t('Thống kê buổi phát')}</h2>
          <LiveStats stream={stream} />
          {isHost && (
            <div className="flex flex-wrap gap-2 pt-1">
              {stream.recording.status === 'ready' && stream.recording.url && (
                <GlassButton size="sm" onClick={() => setPickingThumbnail(true)}>
                  <ImageIcon aria-hidden />
                  {stream.thumbnailUrl ? t('Đổi ảnh bìa') : t('Chọn ảnh bìa')}
                </GlassButton>
              )}
              <GlassButton asChild tone="sunset" size="sm">
                <Link to={`/users/${stream.host._id}?tab=live`}>{t('Các buổi phát của tôi')}</Link>
              </GlassButton>
              <GlassButton asChild size="sm">
                <Link to="/feed">{t('Về Newsfeed')}</Link>
              </GlassButton>
            </div>
          )}
        </div>
      </section>

      <LiveComments
        comments={comments.data ?? []}
        onSend={async () => undefined}
        disabled
        disabledReason={t('Livestream đã kết thúc.')}
        hostId={stream.host._id}
        className="h-[26rem] lg:h-[calc(100vh-9rem)] lg:max-h-[46rem]"
      />

      {isHost && <ThumbnailPicker stream={stream} open={pickingThumbnail} onOpenChange={setPickingThumbnail} />}
    </div>
  )
}

function Replay({ stream }: { stream: Livestream }) {
  const { status, url } = stream.recording
  // No cover chosen: the opening picture (frames.ts) stands in, rather than the black first frame.
  const [opening, setOpening] = useState<string | null>(null)
  const needsOpening = status === 'ready' && Boolean(url) && !stream.thumbnailUrl
  useEffect(() => {
    if (!needsOpening || !url) return
    let cancelled = false
    void openingFrame(url).then((src) => {
      if (!cancelled) setOpening(src)
    })
    return () => {
      cancelled = true
    }
  }, [needsOpening, url])
  const frame = 'relative aspect-video overflow-hidden rounded-2xl border-2 border-foreground bg-foreground shadow-[4px_4px_0_hsl(var(--foreground))]'

  if (status === 'ready' && url) {
    return (
      <div className={frame}>
        <video
          src={url}
          poster={stream.thumbnailUrl || opening || undefined}
          controls
          playsInline
          preload="metadata"
          className="size-full object-contain"
          aria-label={`${t('Xem lại')}: ${stream.title}`}
        />
      </div>
    )
  }

  const message =
    status === 'processing' || status === 'recording'
      ? { icon: Loader2, spin: true, title: t('Bản ghi đang được xử lý'), text: t('Thường chỉ mất vài phút. Trang sẽ tự hiện video khi xong.') }
      : status === 'failed'
        ? { icon: Film, spin: false, title: t('Livestream đã kết thúc'), text: t('Buổi phát này không lưu được bản ghi.') }
        : { icon: Film, spin: false, title: t('Livestream đã kết thúc'), text: t('Buổi phát này không được lưu lại để xem lại.') }

  return (
    <div className={frame}>
      <img src={stream.host.avatarUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" />
      <div className="relative flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-background">
        <message.icon className={cn('size-8', message.spin && 'animate-spin')} aria-hidden />
        <p className="font-display text-2xl">{message.title}</p>
        <p className="max-w-sm text-sm text-background/80">{message.text}</p>
      </div>
    </div>
  )
}

/** The numbers of a stream: length, audience, engagement. */
/**
 * `featured`: the Newsfeed's replay card — tiles from the National Park surface
 * system (styles/np-surfaces.css), with the number as the tile's headline.
 */
export function LiveStats({
  stream,
  compactView = false,
  featured = false,
}: {
  stream: Livestream
  compactView?: boolean
  featured?: boolean
}) {
  const reactions = totalReactions(stream.reactions)
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Clock, label: t('Thời lượng'), value: formatDuration(stream.durationSec) },
    { icon: Users, label: t('Người xem'), value: compact(stream.uniqueViewers) },
    { icon: Eye, label: t('Cao nhất cùng lúc'), value: compact(stream.peakViewers) },
    { icon: MessageCircle, label: t('Bình luận'), value: compact(stream.commentCount) },
    { icon: Sparkles, label: t('Cảm xúc#reactions'), value: compact(reactions) },
  ]

  if (featured) {
    return (
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => (
          <div key={s.label} className={cn('np-stat flex flex-col justify-between gap-1 px-3 py-2.5', i === 0 && 'col-span-2 sm:col-span-1')}>
            <dt className="flex items-start gap-1.5 text-xs font-medium leading-snug text-np-meta">
              <s.icon className={cn('mt-px size-3.5 shrink-0', i === 0 && 'text-np-social')} aria-hidden />
              <span>{s.label}</span>
            </dt>
            <dd className="text-lg leading-tight sm:text-xl">{s.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="space-y-3">
      <dl className={cn('grid gap-2', compactView ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
        {stats.map((s) => (
          <div key={s.label} className={cn('rounded-xl bg-muted/60', compactView ? 'px-2.5 py-2' : 'p-3')}>
            <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <s.icon className="size-3.5" aria-hidden />
              {s.label}
            </dt>
            <dd className={cn('font-semibold tabular-nums', compactView ? 'text-sm' : 'mt-0.5 text-lg')}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {!compactView && reactions > 0 && (
        <p className="flex flex-wrap gap-3 text-sm">
          {REACTION_KINDS.filter((k) => stream.reactions[k] > 0).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1">
              <span aria-hidden>{REACTIONS[kind].emoji}</span>
              <span className="tabular-nums">{compact(stream.reactions[kind])}</span>
              <span className="sr-only">{REACTIONS[kind].label}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
