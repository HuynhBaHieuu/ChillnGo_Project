import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ORDER_STATUS_LABELS } from '@/features/billing/labels'
import { localeTag, t, tx } from '@/i18n'
import { formatVnd } from '@/lib/format'
import { billingService } from '@/services'
import type { OrderStatus } from '@/services/types'

import { Pagination, formatDateTime } from './shared'

const FILTERS: (OrderStatus | 'all')[] = ['all', 'paid', 'pending', 'cancelled', 'expired']

/** Doanh thu: the revenue summary and every PayOS order. */
export function RevenuePanel() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('paid')
  const [page, setPage] = useState(1)
  const data = useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: () => billingService.getAdminOrders({ status: status === 'all' ? undefined : status, page }),
  })

  if (data.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('Đang tải…')}
      </p>
    )
  }
  if (data.isError) return <p className="text-sm text-destructive">{(data.error as Error).message}</p>

  const { summary } = data.data
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={t('Tổng doanh thu')} value={formatVnd(summary.revenue)} hint={t('{n} đơn đã thanh toán', { n: summary.paidOrders })} />
        <Tile label={t('Doanh thu 30 ngày')} value={formatVnd(summary.revenue30)} hint={t('{n} đơn đã thanh toán', { n: summary.paidOrders30 })} />
        <Tile label={t('Thành viên Premium')} value={summary.premiumMembers.toLocaleString(localeTag())} />
        <Tile label={t('Cơ sở đang được đề xuất')} value={summary.promotedBusinesses.toLocaleString(localeTag())} />
      </dl>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('Theo gói')}</h3>
        <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/10 text-sm">
          {summary.byProduct.map((row) => (
            <li key={row.product} className="flex items-center justify-between gap-4 px-4 py-3">
              <span>{tx(row.name)}</span>
              <span className="tabular-nums text-muted-foreground">
                {t('{n} đơn', { n: row.count })} · <span className="font-semibold text-foreground">{formatVnd(row.revenue)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | 'all')
            setPage(1)
          }}
        >
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {f === 'all' ? t('Tất cả') : t(ORDER_STATUS_LABELS[f])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {data.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('Chưa có đơn hàng nào.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">{t('Mã đơn')}</th>
                  <th className="px-4 py-2">{t('Người mua')}</th>
                  <th className="px-4 py-2">{t('Gói')}</th>
                  <th className="px-4 py-2 text-right">{t('Số tiền')}</th>
                  <th className="px-4 py-2">{t('Trạng thái')}</th>
                  <th className="px-4 py-2">{t('Thời gian')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {data.data.items.map((order) => (
                  <tr key={order._id}>
                    <td className="px-4 py-2 font-mono text-xs">{order.orderCode}</td>
                    <td className="px-4 py-2">{order.buyer ? `${order.buyer.displayName} (@${order.buyer.username})` : '—'}</td>
                    <td className="px-4 py-2">{tx(order.productName)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatVnd(order.amount)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={order.status === 'paid' ? 'solid' : 'outline'}>{t(ORDER_STATUS_LABELS[order.status])}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(order.paidAt ?? order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={data.data.page} pageSize={data.data.pageSize} total={data.data.total} onPage={setPage} />
      </section>
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-foreground/15 bg-card p-5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-display text-2xl tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}
