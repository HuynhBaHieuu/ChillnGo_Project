import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, Megaphone, PenLine, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCheckout } from '@/features/billing/useCheckout'
import { t, tx } from '@/i18n'
import { formatShortDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { billingService, businessService } from '@/services'
import type { Business, BusinessAd, BusinessAdInput, BusinessInput } from '@/services/types'

import { AdCard } from './AdCard'
import { AdForm } from './AdForm'
import { BusinessForm } from './BusinessForm'
import { BUSINESS_STATUS_LABELS } from './labels'

const MINE = ['business', 'mine'] as const

/**
 * /business — "Doanh nghiệp của tôi": register a business page, see where its
 * review stands, edit it, write ads, and buy the "Đề xuất" package.
 */
export function MyBusinessPage() {
  const mine = useQuery({ queryKey: MINE, queryFn: businessService.getMine })

  return (
    <PageContainer>
      <PageHeader
        title={t('Doanh nghiệp của tôi')}
        description={t('Homestay, khách sạn, quán ăn, quán cà phê hay tour: mở trang cơ sở miễn phí, đăng bài quảng cáo và mua gói Đề xuất để xuất hiện ở trang Khám phá.')}
      />
      {mine.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải…')}
        </p>
      )}
      {mine.isError && <p className="text-sm text-destructive">{(mine.error as Error).message}</p>}
      {mine.data &&
        (mine.data.business ? <Dashboard business={mine.data.business} ads={mine.data.posts} /> : <Register />)}
    </PageContainer>
  )
}

function Register() {
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: (input: BusinessInput) => businessService.register(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE }),
  })
  return (
    <GlassCard className="p-6">
      <h2 className="mb-1 font-display text-xl">{t('Đăng ký cơ sở kinh doanh')}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('Quản trị viên sẽ xem xét trước khi trang của bạn hiển thị công khai. Mỗi tài khoản đăng ký được một cơ sở.')}
      </p>
      <BusinessForm
        business={null}
        submitLabel={t('Gửi duyệt')}
        pending={create.isPending}
        error={create.isError ? (create.error as Error).message : null}
        onSubmit={(input) => create.mutate(input)}
      />
    </GlassCard>
  )
}

function Dashboard({ business, ads }: { business: Business; ads: BusinessAd[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const update = useMutation({
    mutationFn: (input: BusinessInput) => businessService.updateMine(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MINE })
      setEditing(false)
    },
  })

  return (
    <div className="space-y-8">
      <StatusCard business={business} />

      <GlassCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">{business.name}</h2>
          <div className="flex gap-2">
            {business.status === 'approved' && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/b/${business.slug}`}>
                  <ExternalLink className="size-4" aria-hidden />
                  {t('Xem trang công khai')}
                </Link>
              </Button>
            )}
            {!editing && business.status !== 'hidden' && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <PenLine className="size-4" aria-hidden />
                {t('Sửa thông tin')}
              </Button>
            )}
          </div>
        </div>
        {editing ? (
          <BusinessForm
            business={business}
            submitLabel={business.status === 'rejected' ? t('Lưu và gửi duyệt lại') : t('Lưu thay đổi')}
            pending={update.isPending}
            error={update.isError ? (update.error as Error).message : null}
            onSubmit={(input) => update.mutate(input)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label={t('Địa chỉ')} value={business.address} />
            <Info label={t('Số điện thoại')} value={business.phone} />
            {business.openingHours && <Info label={t('Giờ mở cửa')} value={business.openingHours} />}
            {(business.priceFrom !== null || business.priceTo !== null) && (
              <Info
                label={t('Khoảng giá')}
                value={[business.priceFrom, business.priceTo].filter((p): p is number => p !== null).map(formatVnd).join(' – ')}
              />
            )}
          </dl>
        )}
      </GlassCard>

      <BoostCard business={business} />
      <Ads business={business} ads={ads} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function StatusCard({ business }: { business: Business }) {
  const status = business.status ?? 'pending'
  const text = {
    pending: t('Hồ sơ đang chờ quản trị viên duyệt. Bạn vẫn có thể soạn bài quảng cáo trong lúc chờ.'),
    approved: t('Trang cơ sở đang hiển thị công khai.'),
    rejected: t('Hồ sơ chưa được duyệt. Hãy sửa theo góp ý rồi gửi lại.'),
    hidden: t('Trang cơ sở đang bị quản trị viên ẩn.'),
  }[status]
  return (
    <div
      role="status"
      className={cn(
        'rounded-2xl border px-5 py-4 text-sm',
        status === 'approved' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-foreground/15 bg-muted/40',
        (status === 'rejected' || status === 'hidden') && 'border-destructive/30 bg-destructive/10',
      )}
    >
      <Badge variant={status === 'approved' ? 'solid' : 'outline'} className="mb-2">
        {t(BUSINESS_STATUS_LABELS[status])}
      </Badge>
      <p>{text}</p>
      {business.statusReason && (status === 'rejected' || status === 'hidden') && (
        <p className="mt-1 font-semibold">{t('Lý do: {reason}', { reason: business.statusReason })}</p>
      )}
      {business.moderation && (
        <p className="mt-1 font-semibold text-destructive">
          {t('Đã bị ẩn do vi phạm')}
          {business.moderation.reason && `: ${business.moderation.reason}`}
        </p>
      )}
    </div>
  )
}

/** The "Đề xuất" package: how long it runs, and buying (more of) it. */
function BoostCard({ business }: { business: Business }) {
  const plans = useQuery({ queryKey: ['billing', 'plans'], queryFn: billingService.getPlans })
  const checkout = useCheckout()
  const product = plans.data?.products.find((p) => p.kind === 'boost')
  const until = business.promotedUntil && new Date(business.promotedUntil) > new Date() ? business.promotedUntil : null
  const canBuy = business.status === 'approved' && Boolean(plans.data?.paymentsEnabled)

  return (
    <GlassCard className="p-6">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Megaphone className="size-5 text-amber-400" aria-hidden />
        {t('Gói Đề xuất')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('Trong thời gian còn gói, thẻ cơ sở và các bài quảng cáo của bạn hiện ở mục "Gợi ý nổi bật" trên trang Khám phá, có nhãn Tài trợ.')}
      </p>
      <p className="mt-3 text-sm font-semibold">
        {until ? t('Đang được đề xuất đến {date}.', { date: formatShortDate(until) }) : t('Chưa có gói Đề xuất.')}
      </p>
      {product && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="font-display text-2xl tabular-nums">{formatVnd(product.amount)}</span>
          <span className="text-sm text-muted-foreground">{tx(product.name)}</span>
          <GlassButton
            tone="sunset"
            disabled={!canBuy || checkout.isPending}
            onClick={() => checkout.mutate({ product: product.id, businessId: business._id })}
          >
            {checkout.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {until ? t('Gia hạn') : t('Mua gói')}
          </GlassButton>
        </div>
      )}
      {business.status !== 'approved' && (
        <p className="mt-3 text-xs text-muted-foreground">{t('Cơ sở cần được duyệt trước khi mua gói Đề xuất.')}</p>
      )}
      {plans.data && !plans.data.paymentsEnabled && (
        <p className="mt-3 text-xs text-destructive">{t('Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.')}</p>
      )}
      {checkout.isError && <p className="mt-3 text-sm text-destructive">{(checkout.error as Error).message}</p>}
    </GlassCard>
  )
}

function Ads({ business, ads }: { business: Business; ads: BusinessAd[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<BusinessAd | 'new' | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: MINE })

  const save = useMutation({
    mutationFn: (input: BusinessAdInput) =>
      editing && editing !== 'new' ? businessService.updateAd(editing._id, input) : businessService.createAd(input),
    onSuccess: async () => {
      await refresh()
      setEditing(null)
    },
  })
  const remove = useMutation({ mutationFn: (id: string) => businessService.deleteAd(id), onSuccess: refresh })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{t('Bài quảng cáo')}</h2>
        {editing === null && business.status !== 'hidden' && (
          <GlassButton onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('Viết bài mới')}
          </GlassButton>
        )}
      </div>
      {editing !== null && (
        <GlassCard className="p-6">
          <AdForm
            key={editing === 'new' ? 'new' : editing._id}
            ad={editing === 'new' ? null : editing}
            pending={save.isPending}
            error={save.isError ? (save.error as Error).message : null}
            onSubmit={(input) => save.mutate(input)}
            onCancel={() => setEditing(null)}
          />
        </GlassCard>
      )}
      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Chưa có bài quảng cáo nào.')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <AdCard
              key={ad._id}
              ad={ad}
              actions={
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(ad)}>
                    <PenLine className="size-4" aria-hidden />
                    {t('Sửa')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t('Xoá bài quảng cáo này?'))) remove.mutate(ad._id)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t('Xoá')}
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
