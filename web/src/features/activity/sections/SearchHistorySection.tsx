import { FileText, Map as MapIcon, MapPin, Search, User, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Confirm, Empty, ErrorPanel, ListSkeleton, Row, SectionHeader } from '@/features/activity/components'
import { timeAgo } from '@/features/activity/format'
import { useClearSearchHistory, useRemoveSearch, useSearchHistory } from '@/features/activity/hooks'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import type { SearchEntry, SearchType } from '@/services/activity.service'

const TYPES: Record<SearchType, { label: MessageKey; icon: LucideIcon }> = {
  journey: { label: 'Hành trình', icon: MapIcon },
  place: { label: 'Địa điểm', icon: MapPin },
  post: { label: 'Bài viết', icon: FileText },
  user: { label: 'Người dùng#role', icon: User },
}

/** Where searching again takes you. Journey searches reopen Discover; the others have no search page. */
function searchAgainHref(entry: SearchEntry): string | null {
  return entry.type === 'journey' ? `/discover?q=${encodeURIComponent(entry.query)}` : null
}

export function SearchHistorySection() {
  const history = useSearchHistory()
  const remove = useRemoveSearch()
  const clear = useClearSearchHistory()
  const [confirmClear, setConfirmClear] = useState(false)

  const hasItems = Boolean(history.data?.length)

  return (
    <>
      <SectionHeader
        title={t('Lịch sử tìm kiếm')}
        description={t('Những lần bạn tìm kiếm ở trang Khám phá và khi chọn địa điểm check-in. Chỉ mình bạn thấy được.')}
        action={
          hasItems && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirmClear(true)}>
              {t('Xoá tất cả')}
            </Button>
          )
        }
      />

      {history.isPending ? (
        <ListSkeleton rows={5} />
      ) : history.isError ? (
        <ErrorPanel error={history.error} onRetry={() => void history.refetch()} />
      ) : !hasItems ? (
        <Empty icon={Search} title={t('Chưa có lượt tìm kiếm nào')} description={t('Tìm hành trình ở trang Khám phá, các lượt tìm của bạn sẽ được liệt kê ở đây.')} />
      ) : (
        <ul className="space-y-1">
          {history.data.map((entry) => {
            const type = TYPES[entry.type]
            const href = searchAgainHref(entry)
            const body = (
              <>
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-np-well text-np-sage shadow-[inset_0_1px_2px_hsl(var(--np-shadow)/0.5)]">
                  <type.icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-np-cream">{entry.query}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {t(type.label)} · {timeAgo(entry.searchedAt)}
                  </p>
                </div>
              </>
            )
            return (
              <Row key={entry._id}>
                {href ? (
                  <Link to={href} className="flex min-w-0 flex-1 items-center gap-4" title={t('Tìm lại')}>
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-4">{body}</div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full"
                  aria-label={t('Xoá “{query}” khỏi lịch sử tìm kiếm', { query: entry.query })}
                  disabled={remove.isPending && remove.variables === entry._id}
                  onClick={() => remove.mutate(entry._id)}
                >
                  <X aria-hidden />
                </Button>
              </Row>
            )
          })}
        </ul>
      )}

      {remove.isError && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {(remove.error as Error).message}
        </p>
      )}

      <Confirm
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t('Xoá toàn bộ lịch sử tìm kiếm?')}
        description={
          <>
            {t('Mọi lượt tìm kiếm trong lịch sử sẽ bị xoá. Không thể hoàn tác.')}
            {clear.isError && <span className="mt-2 block text-destructive">{(clear.error as Error).message}</span>}
          </>
        }
        confirmLabel={t('Xoá tất cả')}
        destructive
        pending={clear.isPending}
        onConfirm={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
      />
    </>
  )
}
