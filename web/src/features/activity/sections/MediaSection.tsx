import { Camera, Clapperboard, Eye, Film, Map as MapIcon, MoreHorizontal, Play, Radio, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ActivityTabs,
  Confirm,
  Empty,
  ErrorPanel,
  ListSkeleton,
  NotAvailable,
  Row,
  SectionHeader,
} from '@/features/activity/components'
import { dateTime, duration, timeAgo } from '@/features/activity/format'
import { useDeleteCheckIn, useJourneyAction, useMyCheckIns, useMyPublishedJourneys, useMyStreams } from '@/features/activity/hooks'
import { themeFromText, travelCover } from '@/lib/photos'
import { cn } from '@/lib/utils'
import { postService } from '@/services'
import type { Livestream } from '@/services/livestream.service'

export function MediaSection() {
  return (
    <>
      <SectionHeader
        title="Ảnh và video"
        description="Mọi thứ bạn đã chia sẻ: hành trình, check-in ảnh, bản ghi livestream và các buổi phát trực tiếp của bạn."
      />
      <ActivityTabs
        label="Loại nội dung"
        tabs={[
          { value: 'posts', label: 'Bài viết', content: <Posts /> },
          { value: 'videos', label: 'Video', content: <Videos /> },
          {
            value: 'stories',
            label: 'Tin',
            content: (
              <NotAvailable
                icon={Clapperboard}
                feature="tính năng tin (story)"
                description="Khi có tính năng tin, những tin bạn đăng sẽ được gom lại ở đây."
              />
            ),
          },
          { value: 'live', label: 'Trực tiếp', content: <Live /> },
        ]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ posts */

type Tile =
  | { kind: 'journey'; id: string; at: string; image: string; title: string }
  | { kind: 'checkin'; id: string; at: string; image: string | null; title: string }

function Posts() {
  const checkins = useMyCheckIns()
  const journeys = useMyPublishedJourneys()
  const [confirm, setConfirm] = useState<Tile | null>(null)
  const deleteCheckIn = useDeleteCheckIn()
  const deleteJourney = useJourneyAction(postService.deleteJourney)
  const deleting = deleteCheckIn.isPending || deleteJourney.isPending

  if (checkins.isPending || journeys.isPending) return <ListSkeleton rows={8} media />
  if (journeys.isError) return <ErrorPanel error={journeys.error} onRetry={() => void journeys.refetch()} />
  if (checkins.isError) return <ErrorPanel error={checkins.error} onRetry={() => void checkins.refetch()} />

  const tiles: Tile[] = [
    ...journeys.data.map((p) => ({
      kind: 'journey' as const,
      id: p._id,
      at: p.createdAt,
      // Same automatic cover the journey gets everywhere else when none was chosen.
      image: p.coverUrl || travelCover(p.title.slice(0, 30) || 'chillngo', themeFromText(p.title)),
      title: p.title || 'Hành trình chưa đặt tên',
    })),
    ...checkins.data.map((c) => ({
      kind: 'checkin' as const,
      id: c._id,
      at: c.createdAt,
      image: c.photos[0]?.url ?? null,
      title: c.caption || c.location?.name || 'Check-in',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  if (tiles.length === 0) {
    return (
      <Empty
        icon={Camera}
        title="Bạn chưa chia sẻ gì"
        description="Hành trình bạn đăng và ảnh bạn check-in sẽ hiện ở đây."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/feed">Check-in ngay</Link>
          </Button>
        }
      />
    )
  }

  const error = deleteCheckIn.error ?? deleteJourney.error

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={`${tile.kind}-${tile.id}`} className="group relative">
            <div className="np-media relative aspect-square overflow-hidden rounded-[14px] bg-np-well transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none">
              {tile.image ? (
                <img src={tile.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                // A text-only check-in: a quiet tile; its words are in the caption below.
                <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,hsl(var(--np-moss)/0.35),transparent_60%)]">
                  <Camera className="size-8 text-np-sage/70" strokeWidth={1.5} aria-hidden />
                </span>
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-np-canopy/90 via-np-canopy/10 to-transparent" aria-hidden />
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-np-canopy/75 px-2 py-0.5 text-[11px] font-semibold text-np-cream">
                {tile.kind === 'journey' ? <MapIcon className="size-3" aria-hidden /> : <Camera className="size-3" aria-hidden />}
                {tile.kind === 'journey' ? 'Hành trình' : 'Check-in'}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="truncate text-sm font-semibold text-np-cream">{tile.title}</p>
                <p className="text-xs text-np-meta">{timeAgo(tile.at)}</p>
              </div>
              {tile.kind === 'journey' && (
                <Link to={`/posts/${tile.id}`} className="absolute inset-0" aria-label={`Mở ${tile.title}`} />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Thêm tuỳ chọn cho ${tile.title}`}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-np-canopy/75 text-np-cream opacity-100 transition-opacity hover:bg-np-canopy focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tile.kind === 'journey' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to={`/posts/${tile.id}`}>Xem</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/posts/${tile.id}/edit`}>Chỉnh sửa</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => setConfirm(tile)} className="text-destructive">
                  <Trash2 />
                  Xoá
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Confirm
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === 'journey' ? 'Xoá hành trình này?' : 'Xoá check-in này?'}
        description={
          <>
            Nội dung sẽ được chuyển vào mục Đã xoá gần đây, bạn có thể khôi phục trong 30 ngày.
            {error && <span className="mt-2 block text-destructive">{(error as Error).message}</span>}
          </>
        }
        confirmLabel="Xoá"
        destructive
        pending={deleting}
        onConfirm={() => {
          if (!confirm) return
          const done = { onSuccess: () => setConfirm(null) }
          if (confirm.kind === 'journey') deleteJourney.mutate(confirm.id, done)
          else deleteCheckIn.mutate(confirm.id, done)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ videos */

function StreamPoster({ stream, className }: { stream: Livestream; className?: string }) {
  return (
    <div className={cn('np-media relative aspect-video overflow-hidden rounded-[12px] bg-np-canopy', className)}>
      <img src={stream.host.avatarUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl" />
      <span className="absolute inset-0 bg-gradient-to-t from-np-canopy/85 via-np-canopy/30 to-transparent" aria-hidden />
    </div>
  )
}

function Videos() {
  const { past } = useMyStreams()

  if (past.isPending) return <ListSkeleton rows={6} media />
  if (past.isError) return <ErrorPanel error={past.error} onRetry={() => void past.refetch()} />

  const recorded = past.data.pages
    .flatMap((p) => p.items)
    .filter((s) => s.recording.status === 'ready' || s.recording.status === 'processing')

  if (recorded.length === 0) {
    return (
      <Empty
        icon={Film}
        title="Chưa có video nào"
        description="Bật ghi hình khi phát trực tiếp, bản ghi sẽ được giữ lại ở đây."
        action={past.hasNextPage ? <LoadMore query={past} /> : undefined}
      />
    )
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {recorded.map((stream) => {
          const ready = stream.recording.status === 'ready'
          return (
            <li key={stream._id}>
              <Link to={`/live/${stream._id}`} className="group block">
                <div className="relative">
                  <StreamPoster stream={stream} className="transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="np-glow-social grid size-11 place-items-center rounded-full bg-np-social text-np-ink transition-transform group-hover:scale-105 motion-reduce:transition-none">
                      <Play className="ml-0.5 size-4" aria-hidden />
                    </span>
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-full bg-np-canopy/75 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-np-cream">
                    {ready ? duration(stream.recording.durationSec || stream.durationSec) : 'Đang xử lý…'}
                  </span>
                </div>
                <p className="mt-2.5 truncate font-display text-lg leading-snug text-np-cream group-hover:underline">{stream.title}</p>
                <p className="text-[13px] text-muted-foreground">
                  {dateTime(stream.startedAt)} · {stream.uniqueViewers.toLocaleString('vi-VN')} người xem
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
      {past.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <LoadMore query={past} />
        </div>
      )}
    </>
  )
}

function LoadMore({ query }: { query: ReturnType<typeof useMyStreams>['past'] }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
    </Button>
  )
}

/* -------------------------------------------------------------------- live */

const RECORDING_LABEL: Record<Livestream['recording']['status'], string | null> = {
  none: null,
  recording: 'Đang ghi hình',
  processing: 'Bản ghi đang xử lý',
  ready: 'Có bản xem lại',
  failed: 'Ghi hình thất bại',
}

function Live() {
  const { live, past } = useMyStreams()

  if (live.isPending || past.isPending) return <ListSkeleton />
  if (past.isError) return <ErrorPanel error={past.error} onRetry={() => void past.refetch()} />

  const streams = [...(live.data ?? []), ...past.data.pages.flatMap((p) => p.items)]

  if (streams.length === 0) {
    return (
      <Empty
        icon={Radio}
        title="Bạn chưa phát trực tiếp lần nào"
        description="Bắt đầu livestream từ ô đăng bài ở Newsfeed. Mọi buổi bạn phát sẽ được liệt kê ở đây."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/live">Đến trang Đang live</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <ul className="space-y-1">
        {streams.map((stream) => {
          const isLive = stream.status === 'live'
          const recording = RECORDING_LABEL[stream.recording.status]
          return (
            <Row key={stream._id}>
              <Link to={`/live/${stream._id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative w-28 shrink-0 sm:w-32">
                  <StreamPoster stream={stream} />
                  {isLive ? (
                    <span className="np-glow-social absolute left-1.5 top-1.5 rounded bg-np-social px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-np-ink">
                      Live
                    </span>
                  ) : (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-np-canopy/75 px-1.5 text-[10px] font-semibold tabular-nums text-np-cream">
                      {duration(stream.durationSec)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg leading-snug text-np-cream group-hover:underline">{stream.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {isLive ? `Đang phát · bắt đầu ${timeAgo(stream.startedAt)}` : dateTime(stream.startedAt)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-np-meta">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" aria-hidden />
                      cao nhất {stream.peakViewers.toLocaleString('vi-VN')}
                    </span>
                    {recording && <span>{recording}</span>}
                  </p>
                </div>
              </Link>
            </Row>
          )
        })}
      </ul>
      {past.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <LoadMore query={past} />
        </div>
      )}
    </>
  )
}
