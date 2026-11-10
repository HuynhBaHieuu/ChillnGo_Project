import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, RefreshCw, Square } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { t, translated } from '@/i18n'
import { adminService } from '@/services'
import type { LiveStreamRow } from '@/services/admin.service'

import { PersonLine } from './ReportsPanel'
import { ConfirmDialog, formatDateTime } from './shared'
import type { Notice } from './shared'

const AUDIENCE_LABELS = translated<LiveStreamRow['audience']>({
  public: 'Công khai',
  followers: 'Người theo dõi',
  private: 'Riêng tư',
})

/** Đang phát: every live stream right now, and the button to stop one. Needs the content module. */
export function LiveStreamsPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [stopping, setStopping] = useState<LiveStreamRow | null>(null)
  const [reason, setReason] = useState('')

  const list = useQuery({
    queryKey: ['admin', 'livestreams'],
    queryFn: adminService.listLiveStreams,
    refetchInterval: 30_000,
  })

  const end = useMutation({
    mutationFn: (stream: LiveStreamRow) => adminService.endLiveStream(stream._id, reason.trim()),
    onSuccess: (_data, stream) => {
      onNotice({ kind: 'success', text: t('Đã dừng buổi livestream “{title}”.', { title: stream.title }) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'livestreams'] })
      setStopping(null)
      setReason('')
    },
    onError: (error) => {
      onNotice({ kind: 'error', text: (error as Error).message })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'livestreams'] })
      setStopping(null)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('Mọi buổi đang phát, kể cả riêng tư. Dừng một buổi sẽ đưa người xem ra ngoài và đóng phòng; bản ghi (nếu có) vẫn được giữ.')}
        </p>
        <Button variant="outline" size="sm" onClick={() => void list.refetch()} disabled={list.isFetching} className="shrink-0">
          <RefreshCw className={list.isFetching ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
          {t('Làm mới')}
        </Button>
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
          {t('Không có buổi livestream nào đang phát.')}
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('Buổi phát')}</th>
                <th className="px-4 py-3 font-medium">{t('Người phát')}</th>
                <th className="px-4 py-3 font-medium">{t('Người xem')}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t('Thao tác')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((s) => (
                <tr key={s._id} className="border-b border-foreground/5 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-destructive px-2 py-0.5 font-semibold text-white">LIVE</span>
                      {AUDIENCE_LABELS[s.audience]} · {formatDateTime(s.startedAt)}
                    </p>
                    <p className="mt-1 max-w-72 truncate font-semibold">{s.title}</p>
                    {s.audience !== 'private' && (
                      <Link to={`/live/${s._id}`} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs underline">
                        {t('Mở trong ứng dụng')}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PersonLine person={s.host} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="block text-sm font-semibold tabular-nums text-foreground">{s.viewerCount}</span>
                    {t('cao nhất {n} · {c} bình luận', { n: s.peakViewers, c: s.commentCount })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="destructive" size="sm" onClick={() => setStopping(s)}>
                      <Square className="size-4" aria-hidden />
                      {t('Dừng phát')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={stopping !== null}
        onOpenChange={(open) => {
          if (open) return
          setStopping(null)
          setReason('')
        }}
        title={t('Dừng buổi livestream này?')}
        description={t('Người xem bị đưa ra ngoài và phòng đóng lại ngay. Người phát nhận được thông báo kèm lý do. Hành động được ghi vào nhật ký.')}
        confirmLabel={t('Dừng phát')}
        destructive
        pending={end.isPending}
        onConfirm={() => stopping && end.mutate(stopping)}
      >
        <div className="space-y-2">
          <Label htmlFor="end-stream-reason">{t('Lý do (người phát sẽ thấy)')}</Label>
          <Textarea id="end-stream-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
