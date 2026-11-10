import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Eye, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { REPORT_TARGET_LABELS } from '@/features/report/labels'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { reportService } from '@/services'
import type { HiddenItem, HiddenTargetType } from '@/services/report.service'

import { PersonLine, Thumb, TypeBadge } from './ReportsPanel'
import { linkFor } from './moderationLinks'
import { ConfirmDialog, Pagination, formatDateTime } from './shared'
import type { Notice } from './shared'

const TYPES: HiddenTargetType[] = ['post', 'checkin', 'comment']

/**
 * Đang bị ẩn: everything moderation has hidden or removed right now, reports
 * pending or not. Needs the content module, which is what unhiding needs.
 */
export function HiddenContentPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<HiddenTargetType>('post')
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState<HiddenItem | null>(null)

  const params = { targetType: type, page }
  const list = useQuery({
    queryKey: ['admin', 'hidden', params],
    queryFn: () => reportService.listHidden(params),
    placeholderData: keepPreviousData,
  })

  const unhide = useMutation({
    mutationFn: (item: HiddenItem) => reportService.unhideContent(item.targetType, item.targetId),
    onSuccess: (_data, item) => {
      onNotice({ kind: 'success', text: item.action === 'remove' ? t('Đã khôi phục nội dung.') : t('Đã hiện lại nội dung.') })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'hidden'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
      setConfirming(null)
    },
    onError: (error) => {
      onNotice({ kind: 'error', text: (error as Error).message })
      setConfirming(null)
    },
  })

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t('Loại nội dung')} className="inline-flex rounded-full border border-foreground/15 bg-card p-1">
        {TYPES.map((tp) => (
          <button
            key={tp}
            type="button"
            role="tab"
            aria-selected={type === tp}
            onClick={() => {
              setType(tp)
              setPage(1)
            }}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              type === tp ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(REPORT_TARGET_LABELS[tp])}
          </button>
        ))}
      </div>

      {list.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải danh sách…')}
        </p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : list.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {t('Không có nội dung nào đang bị ẩn.')}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('Nội dung')}</th>
                  <th className="px-4 py-3 font-medium">{t('Chủ nội dung')}</th>
                  <th className="px-4 py-3 font-medium">{t('Bị ẩn')}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('Thao tác')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => {
                  const link = linkFor(item.targetType, item.targetId, item.snapshot)
                  return (
                    <tr key={item.targetId} className="border-b border-foreground/5 align-top last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb snapshot={item.snapshot} type={item.targetType} />
                          <div className="min-w-0 max-w-72">
                            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <TypeBadge type={item.targetType} />
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                                {item.action === 'remove' ? t('Đã gỡ') : item.hiddenBySystem ? t('Tự động ẩn tạm') : t('Đã ẩn')}
                              </span>
                            </p>
                            <p className="mt-1 truncate font-semibold">{item.snapshot.title || item.snapshot.text || t('(không có tiêu đề)')}</p>
                            {item.snapshot.title && item.snapshot.text && (
                              <p className="truncate text-xs text-muted-foreground">{item.snapshot.text}</p>
                            )}
                            {link && (
                              <Link to={link} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs underline">
                                {t('Mở trong ứng dụng')}
                                <ExternalLink className="size-3" aria-hidden />
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PersonLine person={item.owner} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(item.hiddenAt)}
                        <span className="block">
                          {item.hiddenBySystem
                            ? t('bởi hệ thống, sau nhiều báo cáo')
                            : item.hiddenBy
                              ? t('bởi {name}', { name: item.hiddenBy.displayName })
                              : null}
                        </span>
                        {item.reason && <span className="mt-1 block max-w-56 truncate" title={item.reason}>{item.reason}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setConfirming(item)}>
                          <Eye className="size-4" aria-hidden />
                          {item.action === 'remove' ? t('Khôi phục') : t('Hiện lại')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{t('{n} nội dung đang bị ẩn', { n: list.data.total })}</p>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming?.action === 'remove' ? t('Khôi phục nội dung này?') : t('Hiện lại nội dung này?')}
        description={
          confirming?.action === 'remove'
            ? t('Nội dung quay lại như trước khi bị gỡ và rời khỏi mục Đã xoá gần đây của tác giả. Mọi người sẽ thấy lại nó.')
            : t('Mọi người sẽ thấy lại nội dung này. Các báo cáo đang chờ (nếu có) vẫn ở trong hàng chờ.')
        }
        confirmLabel={confirming?.action === 'remove' ? t('Khôi phục') : t('Hiện lại')}
        pending={unhide.isPending}
        onConfirm={() => confirming && unhide.mutate(confirming)}
      />
    </div>
  )
}
