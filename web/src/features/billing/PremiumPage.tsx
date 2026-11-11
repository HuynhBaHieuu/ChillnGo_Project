import { useQuery } from '@tanstack/react-query'
import { Check, Crown, Loader2, Minus, Receipt } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { t, tx } from '@/i18n'
import { formatShortDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { billingService } from '@/services'
import type { Order, PlanBenefits, Product } from '@/services/types'
import { useAuthStore } from '@/store/auth.store'

import { ORDER_STATUS_LABELS } from './labels'
import { useCheckout } from './useCheckout'

/**
 * /premium — what Free and Premium give, buying Premium through PayOS, and
 * your order history. Prices and limits come from the API.
 */
export function PremiumPage() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const plans = useQuery({ queryKey: ['billing', 'plans', user?._id ?? null], queryFn: billingService.getPlans })
  const orders = useQuery({ queryKey: ['billing', 'orders'], queryFn: billingService.getMyOrders, enabled: Boolean(user) })
  const checkout = useCheckout()

  const premiumProducts = plans.data?.products.filter((p) => p.kind === 'premium') ?? []
  const current = plans.data?.current

  return (
    <PageContainer>
      <PageHeader
        title={t('ChillnGo Premium')}
        description={t('Nhiều lượt AI hơn để lên lịch trình, livestream sắc nét hơn và giữ video xem lại lâu hơn. Thanh toán một lần bằng VietQR, không tự động gia hạn.')}
      />

      {plans.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải…')}
        </p>
      )}
      {plans.isError && <p className="text-sm text-destructive">{(plans.error as Error).message}</p>}

      {plans.data && (
        <div className="space-y-10">
          {current?.isPremium && current.premiumUntil && (
            <GlassCard className="flex flex-wrap items-center gap-3 p-5">
              <Crown className="size-5 text-amber-400" aria-hidden />
              <p className="text-sm">
                {t('Bạn đang là thành viên Premium đến {date}. Mua thêm sẽ được cộng dồn số ngày.', {
                  date: formatShortDate(current.premiumUntil),
                })}
              </p>
            </GlassCard>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <PlanCard title={t('Miễn phí')} benefits={plans.data.benefits.free} premium={false} />
            <PlanCard title={t('Premium')} benefits={plans.data.benefits.premium} premium />
          </div>

          <section className="space-y-4">
            <h2 className="font-display text-2xl">{t('Chọn gói Premium')}</h2>
            {!plans.data.paymentsEnabled && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {t('Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.')}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {premiumProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  monthlyFrom={premiumProducts.find((p) => p.days === 30)?.amount ?? null}
                  disabled={!plans.data.paymentsEnabled || checkout.isPending}
                  pending={checkout.isPending && checkout.variables?.product === product.id}
                  signedIn={Boolean(user)}
                  from={location}
                  onBuy={() => checkout.mutate({ product: product.id })}
                />
              ))}
            </div>
            {checkout.isError && <p className="text-sm text-destructive">{(checkout.error as Error).message}</p>}
            <p className="text-xs text-muted-foreground">
              {t('Bấm Thanh toán để mở trang PayOS, quét mã VietQR bằng ứng dụng ngân hàng. Gói được kích hoạt ngay khi PayOS xác nhận đã nhận tiền.')}
            </p>
          </section>

          {user && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <Receipt className="size-5" aria-hidden />
                {t('Lịch sử đơn hàng')}
              </h2>
              <OrderList orders={orders.data ?? []} loading={orders.isPending} />
            </section>
          )}
        </div>
      )}
    </PageContainer>
  )
}

function PlanCard({ title, benefits, premium }: { title: string; benefits: PlanBenefits; premium: boolean }) {
  const rows: { label: string; value: string }[] = [
    { label: t('Lượt AI mỗi ngày'), value: String(benefits.aiDailyLimit) },
    { label: t('Chất lượng livestream'), value: benefits.liveQuality },
    { label: t('Giữ video xem lại'), value: t('{n} ngày', { n: benefits.replayDays }) },
  ]
  return (
    <GlassCard className={cn('p-6', premium && 'ring-1 ring-amber-400/60')}>
      <h3 className="flex items-center gap-2 font-display text-xl">
        {premium && <Crown className="size-5 text-amber-400" aria-hidden />}
        {title}
      </h3>
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t('Huy hiệu Premium cạnh tên')}</dt>
          <dd>{premium ? <Check className="size-4" aria-label={t('Có')} /> : <Minus className="size-4" aria-label={t('Không')} />}</dd>
        </div>
      </dl>
    </GlassCard>
  )
}

function ProductCard({
  product,
  monthlyFrom,
  disabled,
  pending,
  signedIn,
  from,
  onBuy,
}: {
  product: Product
  monthlyFrom: number | null
  disabled: boolean
  pending: boolean
  signedIn: boolean
  from: ReturnType<typeof useLocation>
  onBuy: () => void
}) {
  // What a year saves against twelve monthly purchases.
  const saving = monthlyFrom && product.days >= 365 ? Math.round((1 - product.amount / ((monthlyFrom * product.days) / 30)) * 100) : 0
  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{tx(product.name)}</p>
          <p className="text-sm text-muted-foreground">{t('{n} ngày', { n: product.days })}</p>
        </div>
        {saving > 0 && <Badge variant="solid">{t('Tiết kiệm {n}%', { n: saving })}</Badge>}
      </div>
      <p className="font-display text-3xl tabular-nums">{formatVnd(product.amount)}</p>
      {signedIn ? (
        <GlassButton tone="sunset" disabled={disabled} onClick={onBuy}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t('Thanh toán')}
        </GlassButton>
      ) : (
        <GlassButton asChild tone="sunset">
          <Link to="/login" state={{ from }}>
            {t('Đăng nhập để mua')}
          </Link>
        </GlassButton>
      )}
    </GlassCard>
  )
}

export function OrderList({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('Đang tải…')}
      </p>
    )
  }
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">{t('Bạn chưa có đơn hàng nào.')}</p>
  return (
    <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/10">
      {orders.map((order) => (
        <li key={order._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <span className="block font-semibold">{tx(order.productName)}</span>
            <span className="text-xs text-muted-foreground">
              #{order.orderCode} · {formatShortDate(order.createdAt)}
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums">{formatVnd(order.amount)}</span>
            <Badge variant={order.status === 'paid' ? 'solid' : 'outline'}>{t(ORDER_STATUS_LABELS[order.status])}</Badge>
            {order.status === 'pending' && order.checkoutUrl && (
              <a href={order.checkoutUrl} className="text-xs font-semibold underline">
                {t('Tiếp tục thanh toán')}
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
