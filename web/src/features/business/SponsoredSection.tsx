import { useQuery } from '@tanstack/react-query'
import { MapPin, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { CardCarousel } from '@/features/discovery-admin/components/CardCarousel'
import { DiscoverSection } from '@/features/discovery-admin/components/DiscoverSection'
import { t } from '@/i18n'
import { formatVndShort } from '@/lib/format'
import { businessService } from '@/services'
import type { SponsoredAd } from '@/services/business.service'
import type { Business } from '@/services/types'

import { AdCard } from './AdCard'
import { BUSINESS_TYPE_LABELS, priceUnit } from './labels'

type Item = { kind: 'business'; business: Business } | { kind: 'ad'; ad: SponsoredAd }

/**
 * "Gợi ý nổi bật" on Discover: businesses that bought the "Đề xuất" package,
 * and their latest ads, each marked "Tài trợ". Hidden when there are none.
 */
export function SponsoredSection({ className }: { className?: string }) {
  const sponsored = useQuery({ queryKey: ['business', 'sponsored'], queryFn: businessService.getSponsored, staleTime: 60_000 })
  if (!sponsored.data) return null
  const { businesses, posts } = sponsored.data
  const items: Item[] = [
    ...businesses.map((business) => ({ kind: 'business' as const, business })),
    ...posts.map((ad) => ({ kind: 'ad' as const, ad })),
  ]
  if (items.length === 0) return null

  return (
    <DiscoverSection
      title={t('Gợi ý nổi bật')}
      description={t('Homestay, quán ăn và trải nghiệm đang được tài trợ trên ChillnGo')}
      className={className}
    >
      <CardCarousel
        items={items}
        getKey={(item) => (item.kind === 'business' ? `b-${item.business._id}` : `a-${item.ad._id}`)}
        renderItem={(item) =>
          item.kind === 'business' ? <BusinessCard business={item.business} /> : <AdCard ad={item.ad} business={item.ad.business} sponsored />
        }
      />
    </DiscoverSection>
  )
}

export function BusinessCard({ business }: { business: Business }) {
  return (
    <Link to={`/b/${business.slug}`} className="block">
      <GlassCard interactive className="overflow-hidden">
        <div className="relative aspect-[4/3] bg-muted">
          {business.photos[0] && <img src={business.photos[0]} alt="" className="size-full object-cover" loading="lazy" />}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-amber-300">
            <Megaphone className="size-3" aria-hidden />
            {t('Tài trợ')}
          </span>
        </div>
        <div className="space-y-1 p-4">
          <p className="text-xs text-muted-foreground">{t(BUSINESS_TYPE_LABELS[business.type])}</p>
          <h3 className="font-display text-lg leading-snug">{business.name}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {business.city || business.address}
          </p>
          {business.priceFrom !== null && (
            <p className="text-sm font-semibold">
              {t('Từ {price}', { price: formatVndShort(business.priceFrom) })}
              <span className="font-normal text-muted-foreground">{t(priceUnit(business.type))}</span>
            </p>
          )}
        </div>
      </GlassCard>
    </Link>
  )
}
