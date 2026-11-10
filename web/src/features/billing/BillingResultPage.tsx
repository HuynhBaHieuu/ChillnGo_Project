import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { t, tx } from '@/i18n'
import { formatShortDate, formatVnd } from '@/lib/format'
import { authService, billingService } from '@/services'
import { useAuthStore } from '@/store/auth.store'

import { PENDING_ORDER_KEY } from './useCheckout'

/** Stop asking after this long: the payment may still arrive, the order page will show it. */
const POLL_FOR_MS = 3 * 60 * 1000

/**
 * /billing/result — where PayOS sends the buyer back (?orderCode=…&status=…).
 * Asks the API about the order until it is paid, cancelled or expired; the
 * API checks with PayOS each time, so this works without the webhook too.
 */
export function BillingResultPage() {
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  // Polling stops after POLL_FOR_MS; the page then says the payment has not arrived yet.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), POLL_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [])
  const orderCode = Number(params.get('orderCode') ?? sessionStorage.getItem(PENDING_ORDER_KEY) ?? NaN)
  const cancelledByBuyer = params.get('cancel') === 'true' || params.get('status') === 'CANCELLED'

  const order = useQuery({
    queryKey: ['billing', 'order', orderCode],
    queryFn: () => billingService.getOrder(orderCode),
    enabled: Number.isSafeInteger(orderCode),
    refetchInterval: (query) => (query.state.data?.status === 'pending' && !cancelledByBuyer && !timedOut ? 2500 : false),
  })

  const paid = order.data?.status === 'paid'
  useEffect(() => {
    if (!paid) return
    sessionStorage.removeItem(PENDING_ORDER_KEY)
    // The badge, limits and "Đề xuất" status come from these.
    authService
      .getCurrentUser()
      .then((user) => useAuthStore.getState().patchUser(user))
      .catch(() => undefined)
    void queryClient.invalidateQueries({ queryKey: ['billing'] })
    void queryClient.invalidateQueries({ queryKey: ['business'] })
  }, [paid, queryClient])

  const isBoost = order.data?.product === 'business_boost_month'
  const backTo = isBoost ? '/business' : '/premium'

  return (
    <PageContainer className="max-w-xl">
      <GlassCard className="mt-10 space-y-5 p-8 text-center">
        {!Number.isSafeInteger(orderCode) ? (
          <p className="text-sm text-muted-foreground">{t('Không tìm thấy đơn hàng.')}</p>
        ) : order.isPending ? (
          <Waiting />
        ) : order.isError ? (
          <p className="text-sm text-destructive">{(order.error as Error).message}</p>
        ) : paid ? (
          <>
            <CircleCheck className="mx-auto size-12 text-emerald-400" aria-hidden />
            <h1 className="font-display text-2xl">{t('Thanh toán thành công')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('{product} · {amount}', { product: tx(order.data.productName), amount: formatVnd(order.data.amount) })}
            </p>
            {order.data.grantedUntil && (
              <p className="text-sm">{t('Có hiệu lực đến {date}.', { date: formatShortDate(order.data.grantedUntil) })}</p>
            )}
          </>
        ) : order.data.status === 'pending' && !cancelledByBuyer && !timedOut ? (
          <Waiting />
        ) : (
          <>
            <CircleX className="mx-auto size-12 text-destructive" aria-hidden />
            <h1 className="font-display text-2xl">
              {order.data.status === 'pending' ? t('Chưa nhận được thanh toán') : t('Thanh toán chưa hoàn tất')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.data.status === 'pending'
                ? t('Nếu bạn đã chuyển khoản, gói sẽ tự kích hoạt khi PayOS xác nhận. Bạn có thể xem lại trong Lịch sử đơn hàng.')
                : t('Đơn hàng đã bị huỷ hoặc hết hạn. Bạn chưa bị trừ tiền.')}
            </p>
          </>
        )}
        <GlassButton asChild tone="sunset">
          <Link to={backTo}>{isBoost ? t('Về trang doanh nghiệp') : t('Về trang Premium')}</Link>
        </GlassButton>
      </GlassCard>
    </PageContainer>
  )
}

function Waiting() {
  return (
    <>
      <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" aria-hidden />
      <h1 className="font-display text-2xl">{t('Đang xác nhận thanh toán…')}</h1>
      <p className="text-sm text-muted-foreground">{t('Vui lòng không đóng trang. Việc này thường chỉ mất vài giây.')}</p>
    </>
  )
}
