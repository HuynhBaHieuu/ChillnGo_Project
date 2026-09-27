import { Camera, Clapperboard, Film, Map as MapIcon, RotateCcw, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  ActivityTabs,
  Confirm,
  Empty,
  ErrorPanel,
  ListSkeleton,
  NotAvailable,
  Row,
  SectionHeader,
  Thumb,
} from '@/features/activity/components'
import { daysUntil, journeyStats, plural, timeAgo } from '@/features/activity/format'
import { useDeletedAction, useDeletedItems } from '@/features/activity/hooks'
import { themeFromText, travelCover } from '@/lib/photos'
import { checkinService, postService } from '@/services'

export function RecentlyDeletedSection() {
  return (
    <>
      <SectionHeader
        title="Đã xoá gần đây"
        description="Nội dung đã xoá được giữ ở đây 30 ngày. Bạn có thể khôi phục, hoặc xoá vĩnh viễn trước thời hạn đó."
      />
      <ActivityTabs
        label="Loại nội dung đã xoá"
        tabs={[
          { value: 'posts', label: 'Bài viết', content: <DeletedCheckIns /> },
          {
            value: 'stories',
            label: 'Tin',
            content: (
              <NotAvailable icon={Clapperboard} feature="tính năng tin (story)" description="Khi có tính năng tin, những tin bạn xoá sẽ được giữ ở đây 30 ngày." />
            ),
          },
          {
            value: 'videos',
            label: 'Video',
            content: (
              <Empty
                icon={Film}
                title="Chưa xoá được video"
                description="Bản ghi livestream được giữ cùng buổi phát. Khi có chức năng xoá, những video bạn xoá sẽ hiện ở đây."
              />
            ),
          },
          { value: 'journeys', label: 'Hành trình', content: <DeletedJourneys /> },
        ]}
      />
    </>
  )
}

interface DeletedItem {
  id: string
  title: string
  subtitle: string
  image: string | null
  deletedAt: string
  purgeAt: string
}

function DeletedCheckIns() {
  const { checkins } = useDeletedItems()
  const restore = useDeletedAction(checkinService.restoreCheckIn)
  const purge = useDeletedAction(checkinService.deleteCheckInPermanently)

  if (checkins.isPending) return <ListSkeleton />
  if (checkins.isError) return <ErrorPanel error={checkins.error} onRetry={() => void checkins.refetch()} />

  return (
    <DeletedList
      icon={Camera}
      noun="bài viết"
      emptyText="Những check-in bạn xoá sẽ được giữ ở đây 30 ngày."
      items={checkins.data.map((c) => ({
        id: c._id,
        title: c.caption || c.location?.name || 'Check-in',
        subtitle: [c.photos.length ? plural(c.photos.length, 'ảnh') : null, c.location?.name].filter(Boolean).join(' · ') || 'Check-in',
        image: c.photos[0]?.url ?? null,
        deletedAt: c.deletedAt ?? c.createdAt,
        purgeAt: c.purgeAt ?? c.createdAt,
      }))}
      restore={restore}
      purge={purge}
    />
  )
}

function DeletedJourneys() {
  const { journeys } = useDeletedItems()
  const restore = useDeletedAction(postService.restoreJourney)
  const purge = useDeletedAction(postService.deleteJourneyPermanently)

  if (journeys.isPending) return <ListSkeleton />
  if (journeys.isError) return <ErrorPanel error={journeys.error} onRetry={() => void journeys.refetch()} />

  return (
    <DeletedList
      icon={MapIcon}
      noun="hành trình"
      emptyText="Những hành trình và bản nháp bạn xoá sẽ được giữ ở đây 30 ngày."
      items={journeys.data.map((p) => ({
        id: p._id,
        title: p.title.trim() || 'Hành trình chưa đặt tên',
        subtitle: `${p.status === 'draft' ? 'Bản nháp' : 'Đã đăng'} · ${journeyStats(p)}`,
        image: p.coverUrl || travelCover(p.title.slice(0, 30) || 'chillngo', themeFromText(p.title)),
        deletedAt: p.deletedAt ?? p.updatedAt,
        purgeAt: p.purgeAt ?? p.updatedAt,
      }))}
      restore={restore}
      purge={purge}
    />
  )
}

type Action = ReturnType<typeof useDeletedAction<unknown>>

function DeletedList({
  icon,
  noun,
  emptyText,
  items,
  restore,
  purge,
}: {
  icon: LucideIcon
  noun: string
  emptyText: string
  items: DeletedItem[]
  restore: Action
  purge: Action
}) {
  const [confirm, setConfirm] = useState<DeletedItem | null>(null)

  if (items.length === 0) return <Empty icon={icon} title="Không có gì trong mục này" description={emptyText} />

  const error = restore.error ?? purge.error

  return (
    <>
      <ul className="space-y-1">
        {items.map((item) => {
          const left = daysUntil(item.purgeAt)
          return (
            <Row key={item.id} className="flex-wrap sm:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Thumb src={item.image} className="size-16 opacity-80 grayscale-[35%]" />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg leading-snug text-np-cream">{item.title}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{item.subtitle}</p>
                  <p className="mt-0.5 text-xs text-np-meta">
                    Đã xoá {timeAgo(item.deletedAt)} ·{' '}
                    <span className={left <= 3 ? 'text-np-social' : undefined}>
                      {left === 0 ? 'sẽ bị xoá hôm nay' : `còn ${plural(left, 'ngày')}`}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full sm:flex-none"
                  disabled={restore.isPending && restore.variables === item.id}
                  onClick={() => restore.mutate(item.id)}
                >
                  <RotateCcw aria-hidden />
                  Khôi phục
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 rounded-full text-destructive hover:text-destructive sm:flex-none"
                  onClick={() => setConfirm(item)}
                >
                  <Trash2 aria-hidden />
                  Xoá
                </Button>
              </div>
            </Row>
          )
        })}
      </ul>

      {restore.isError && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {(restore.error as Error).message}
        </p>
      )}

      <Confirm
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Xoá vĩnh viễn ${noun} này?`}
        description={
          <>
            {`“${confirm?.title ?? ''}” sẽ bị xoá vĩnh viễn, kèm cả ảnh. Không thể hoàn tác.`}
            {purge.isError && error && <span className="mt-2 block text-destructive">{(error as Error).message}</span>}
          </>
        }
        confirmLabel="Xoá vĩnh viễn"
        destructive
        pending={purge.isPending}
        onConfirm={() => confirm && purge.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
      />
    </>
  )
}
