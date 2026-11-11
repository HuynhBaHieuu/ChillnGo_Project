import { useQuery } from '@tanstack/react-query'
import { Clock, Globe, Loader2, MapPin, Megaphone, Phone, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { NotFoundPage } from '@/app/landing/NotFoundPage'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { ReportMenu } from '@/features/report/ReportMenu'
import { t } from '@/i18n'
import { formatVnd } from '@/lib/format'
import { googleMapsSearchUrl } from '@/lib/mapsLink'
import { ApiError, businessService } from '@/services'
import type { Business } from '@/services/types'

import { AdCard } from './AdCard'
import { BUSINESS_STATUS_LABELS, BUSINESS_TYPE_LABELS, priceUnit } from './labels'

/** /b/:slug — a business page: its details and ads. Public once an admin approved it. */
export function BusinessPage() {
  const { slug = '' } = useParams()
  const page = useQuery({ queryKey: ['business', 'page', slug], queryFn: () => businessService.getBySlug(slug), retry: false })

  if (page.isPending) {
    return (
      <PageContainer>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải…')}
        </p>
      </PageContainer>
    )
  }
  if (page.isError) {
    if (page.error instanceof ApiError && page.error.status === 404) return <NotFoundPage />
    return (
      <PageContainer>
        <p className="text-sm text-destructive">{(page.error as Error).message}</p>
      </PageContainer>
    )
  }

  const { business, posts } = page.data
  const where =
    business.lat !== null && business.lng !== null ? `${business.lat},${business.lng}` : `${business.name}, ${business.address}`

  return (
    <PageContainer className="space-y-8">
      <Gallery business={business} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(BUSINESS_TYPE_LABELS[business.type])}</Badge>
            {business.sponsored && (
              <Badge variant="solid" className="gap-1">
                <Megaphone className="size-3" aria-hidden />
                {t('Tài trợ')}
              </Badge>
            )}
            {business.status && business.status !== 'approved' && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {t(BUSINESS_STATUS_LABELS[business.status])}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-4xl">{business.name}</h1>
          {business.city && <p className="text-muted-foreground">{business.city}</p>}
        </div>
        <ReportMenu
          targetType="business"
          targetId={business._id}
          ownerId={business.ownerId}
          label={t('Thêm thao tác cho {name}', { name: business.name })}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <GlassCard className="p-6">
          <h2 className="mb-3 font-display text-xl">{t('Giới thiệu')}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {business.description || t('Cơ sở chưa viết giới thiệu.')}
          </p>
        </GlassCard>
        <GlassCard className="space-y-4 p-6 text-sm">
          <Row icon={<MapPin className="size-4" aria-hidden />}>
            <a href={googleMapsSearchUrl(where)} target="_blank" rel="noreferrer" className="hover:underline">
              {business.address}
            </a>
          </Row>
          <Row icon={<Phone className="size-4" aria-hidden />}>
            <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">
              {business.phone}
            </a>
          </Row>
          {business.openingHours && <Row icon={<Clock className="size-4" aria-hidden />}>{business.openingHours}</Row>}
          {(business.priceFrom !== null || business.priceTo !== null) && (
            <Row icon={<Wallet className="size-4" aria-hidden />}>
              {[business.priceFrom, business.priceTo]
                .filter((p): p is number => p !== null)
                .map(formatVnd)
                .join(' – ')}{' '}
              <span className="text-muted-foreground">{t(priceUnit(business.type))}</span>
            </Row>
          )}
          {business.website && (
            <Row icon={<Globe className="size-4" aria-hidden />}>
              <a href={business.website} target="_blank" rel="noreferrer nofollow" className="break-all hover:underline">
                {business.website.replace(/^https?:\/\//, '')}
              </a>
            </Row>
          )}
        </GlassCard>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">{t('Bài quảng cáo')}</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('Chưa có bài quảng cáo nào.')}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((ad) => (
              <AdCard
                key={ad._id}
                ad={ad}
                actions={
                  <div className="flex justify-end">
                    <ReportMenu
                      targetType="businessPost"
                      targetId={ad._id}
                      ownerId={business.ownerId}
                      label={t('Thêm thao tác cho {name}', { name: ad.title })}
                      size="sm"
                    />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

function Gallery({ business }: { business: Business }) {
  if (business.photos.length === 0) return null
  const [first, ...rest] = business.photos
  return (
    <div className="grid gap-3 overflow-hidden rounded-3xl md:grid-cols-[2fr_1fr]">
      <img src={first} alt={business.name} className="aspect-[16/10] w-full object-cover" />
      {rest.length > 0 && (
        <div className="hidden grid-rows-2 gap-3 md:grid">
          {rest.slice(0, 2).map((url) => (
            <img key={url} src={url} alt="" className="size-full object-cover" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  )
}
