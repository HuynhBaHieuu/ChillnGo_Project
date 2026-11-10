import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BUSINESS_STATUS_LABELS, BUSINESS_TYPE_LABELS } from '@/features/business/labels'
import { t } from '@/i18n'
import { formatVnd } from '@/lib/format'
import { businessService } from '@/services'
import type { AdminBusiness, ReviewAction } from '@/services/business.service'
import type { BusinessStatus } from '@/services/types'

import { Pagination, formatDateTime } from './shared'
import type { Notice } from './shared'

const TABS: BusinessStatus[] = ['pending', 'approved', 'rejected', 'hidden']

const ACTION_LABELS: Record<ReviewAction, string> = {
  get approve() {
    return t('Duyệt')
  },
  get reject() {
    return t('Từ chối')
  },
  get hide() {
    return t('Ẩn cơ sở')
  },
  get restore() {
    return t('Hiển thị lại')
  },
}

/** Which decisions apply in each status (the API checks the same). */
const ACTIONS: Record<BusinessStatus, ReviewAction[]> = {
  pending: ['approve', 'reject'],
  approved: ['hide'],
  rejected: ['approve'],
  hidden: ['restore'],
}

/** Doanh nghiệp: the review queue of business pages, by status. */
export function BusinessesPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<BusinessStatus>('pending')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deciding, setDeciding] = useState<{ business: AdminBusiness; action: ReviewAction } | null>(null)
  const [reason, setReason] = useState('')

  const list = useQuery({
    queryKey: ['admin', 'businesses', status, search, page],
    queryFn: () => businessService.getAdminBusinesses({ status, q: search || undefined, page }),
  })

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReviewAction }) => businessService.review(id, action, reason.trim()),
    onSuccess: async (_data, { action }) => {
      onNotice({ kind: 'success', text: t('Đã cập nhật: {action}.', { action: ACTION_LABELS[action] }) })
      setDeciding(null)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  const needsReason = deciding?.action === 'reject' || deciding?.action === 'hide'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(value as BusinessStatus)
            setPage(1)
          }}
        >
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(BUSINESS_STATUS_LABELS[tab])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(q.trim())
            setPage(1)
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Tên, địa chỉ, SĐT…')} className="w-56" />
          <Button type="submit" variant="outline" size="icon" aria-label={t('Tìm')}>
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {list.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải…')}
        </p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : list.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Không có cơ sở nào ở mục này.')}</p>
      ) : (
        <ul className="space-y-4">
          {list.data.items.map((business) => (
            <li key={business._id} className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-card p-5 md:flex-row">
              {business.photos[0] ? (
                <img src={business.photos[0]} alt="" className="h-28 w-full shrink-0 rounded-xl object-cover md:w-40" />
              ) : (
                <div className="hidden h-28 w-40 shrink-0 rounded-xl bg-muted md:block" />
              )}
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{business.name}</span>
                  <Badge variant="outline">{t(BUSINESS_TYPE_LABELS[business.type])}</Badge>
                  {business.sponsored && <Badge variant="solid">{t('Tài trợ')}</Badge>}
                </div>
                <p className="text-muted-foreground">{business.address}</p>
                <p className="text-muted-foreground">
                  {business.phone}
                  {business.priceFrom !== null && ` · ${t('Từ {price}', { price: formatVnd(business.priceFrom) })}`}
                </p>
                {business.owner && (
                  <p className="text-xs text-muted-foreground">
                    {t('Chủ cơ sở: {name} (@{username}) · {email}', {
                      name: business.owner.displayName,
                      username: business.owner.username,
                      email: business.owner.email,
                    })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('Gửi lúc {time}', { time: formatDateTime(business.createdAt) })}
                </p>
                {business.description && <p className="line-clamp-3 pt-1">{business.description}</p>}
                {business.statusReason && <p className="text-xs text-destructive">{t('Lý do: {reason}', { reason: business.statusReason })}</p>}
              </div>
              <div className="flex shrink-0 flex-row flex-wrap gap-2 md:flex-col">
                {business.status === 'approved' && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/b/${business.slug}`} target="_blank">
                      <ExternalLink className="size-4" aria-hidden />
                      {t('Xem trang')}
                    </Link>
                  </Button>
                )}
                {ACTIONS[business.status ?? 'pending'].map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === 'approve' || action === 'restore' ? 'default' : 'outline'}
                    className={action === 'reject' || action === 'hide' ? 'text-destructive' : undefined}
                    onClick={() => (action === 'approve' || action === 'restore' ? review.mutate({ id: business._id, action }) : setDeciding({ business, action }))}
                    disabled={review.isPending}
                  >
                    {ACTION_LABELS[action]}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}

      <Dialog open={deciding !== null} onOpenChange={(open) => !open && setDeciding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding && `${ACTION_LABELS[deciding.action]}: ${deciding.business.name}`}
            </DialogTitle>
            <DialogDescription>{t('Chủ cơ sở sẽ nhận được thông báo kèm lý do này.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-reason">{t('Lý do')}</Label>
            <Textarea id="review-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeciding(null)}>
              {t('Huỷ')}
            </Button>
            <Button
              variant="destructive"
              disabled={review.isPending || (needsReason && reason.trim().length === 0)}
              onClick={() => deciding && review.mutate({ id: deciding.business._id, action: deciding.action })}
            >
              {review.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {deciding && ACTION_LABELS[deciding.action]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
