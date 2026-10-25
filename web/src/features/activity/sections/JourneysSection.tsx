import { Copy, Eye, Map as MapIcon, MoreHorizontal, PenLine, Plus, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Confirm, Empty, ErrorPanel, SectionHeader } from '@/features/activity/components'
import { journeyRoute, journeyStats, timeAgo } from '@/features/activity/format'
import { useDraftJourneys, useJourneyAction } from '@/features/activity/hooks'
import { t } from '@/i18n'
import { themeFromText, travelCover } from '@/lib/photos'
import { postService } from '@/services'
import type { ServerTripPost } from '@/services/post.service'

export function JourneysSection() {
  const drafts = useDraftJourneys()

  return (
    <>
      <SectionHeader
        title={t('Hành trình')}
        description={t('Những hành trình bạn đã bắt đầu lên kế hoạch nhưng chưa đăng. Chúng được lưu vào tài khoản, nên bạn có thể làm tiếp trên bất kỳ thiết bị nào.')}
        action={
          <GlassButton asChild tone="sunset" size="md">
            <Link to="/posts/new">
              <Plus />
              {t('Hành trình mới')}
            </Link>
          </GlassButton>
        }
      />

      <h3 className="mb-4 flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-np-meta">
        {t('Hành trình nháp')}
        {drafts.data && drafts.data.length > 0 && (
          <span className="rounded-full bg-np-well px-2 py-0.5 text-[11px] tabular-nums text-np-cream">{drafts.data.length}</span>
        )}
      </h3>

      {drafts.isPending ? (
        <div className="grid gap-5 md:grid-cols-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-np-card/60">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-2 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="mt-4 h-9 w-40 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : drafts.isError ? (
        <ErrorPanel error={drafts.error} onRetry={() => void drafts.refetch()} />
      ) : drafts.data.length === 0 ? (
        <Empty
          icon={MapIcon}
          title={t('Chưa có hành trình nháp')}
          description={t('Bắt đầu lên kế hoạch cho một chuyến đi và bấm “Lưu nháp” trong trình soạn. Bản nháp sẽ chờ bạn ở đây.')}
          action={
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/posts/new">{t('Bắt đầu một hành trình')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {drafts.data.map((draft) => (
            <DraftJourneyCard key={draft._id} draft={draft} />
          ))}
        </ul>
      )}
    </>
  )
}

type Pending = 'publish' | 'delete' | null

function DraftJourneyCard({ draft }: { draft: ServerTripPost }) {
  const [confirm, setConfirm] = useState<Pending>(null)
  const publish = useJourneyAction(postService.publishJourney)
  const duplicate = useJourneyAction(postService.duplicateJourney)
  const remove = useJourneyAction(postService.deleteJourney)

  const title = draft.title.trim() || t('Hành trình chưa đặt tên')
  const route = journeyRoute(draft)
  const cover = draft.coverUrl || travelCover(draft.title.slice(0, 30) || 'chillngo', themeFromText(draft.title))
  const incomplete = !draft.title.trim() || !draft.summary.trim()
  const busy = publish.isPending || duplicate.isPending || remove.isPending
  const error = publish.error ?? duplicate.error ?? remove.error

  return (
    <li className="liquid-glass group flex flex-col overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none">
      <Link to={`/posts/${draft._id}/edit`} className="relative block aspect-[16/9] overflow-hidden" tabIndex={-1} aria-hidden>
        <img
          src={cover}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-np-canopy/70 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-np-beige/15 bg-np-canopy/75 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-np-cream">
          {t('Nháp')}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        {route && <p className="mb-1 truncate text-[13px] font-semibold text-np-sage">{route}</p>}
        <h4 className="font-display text-xl leading-snug text-np-cream">{title}</h4>
        <p className="mt-1 text-[13px] text-muted-foreground">{journeyStats(draft)}</p>
        <p className="mt-3 text-xs text-np-meta">{t('Sửa lần cuối {time}', { time: timeAgo(draft.updatedAt) })}</p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {(error as Error).message}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <GlassButton asChild tone="sunset" size="md">
            <Link to={`/posts/${draft._id}/edit`}>
              <PenLine />
              {t('Tiếp tục chỉnh sửa')}
            </Link>
          </GlassButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('Thêm thao tác cho {title}', { title })} disabled={busy}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/posts/${draft._id}`}>
                  <Eye />
                  {t('Xem trước')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirm('publish')}>
                <Send />
                {t('Đăng')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicate.mutate(draft._id)}>
                <Copy />
                {t('Nhân bản')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirm('delete')} className="text-destructive">
                <Trash2 />
                {t('Xoá bản nháp')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Confirm
        open={confirm === 'publish'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('Đăng hành trình này?')}
        description={
          incomplete ? (
            <span className="text-destructive">
              {t('Hãy thêm tiêu đề và tóm tắt trước. Bấm Tiếp tục chỉnh sửa để hoàn thiện.')}
            </span>
          ) : (
            t('Hành trình sẽ hiện trên trang cá nhân của bạn, trong Newsfeed của người theo dõi và ở trang Khám phá.')
          )
        }
        confirmLabel={t('Đăng')}
        pending={publish.isPending}
        onConfirm={() => {
          if (incomplete) return setConfirm(null)
          publish.mutate(draft._id, { onSuccess: () => setConfirm(null) })
        }}
      />
      <Confirm
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('Xoá bản nháp này?')}
        description={t('Bản nháp sẽ được chuyển vào mục Đã xoá gần đây, bạn có thể khôi phục trong 30 ngày.')}
        confirmLabel={t('Xoá bản nháp')}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(draft._id, { onSuccess: () => setConfirm(null) })}
      />
    </li>
  )
}
