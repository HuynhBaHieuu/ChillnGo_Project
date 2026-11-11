import { Megaphone, Tag } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { t } from '@/i18n'
import { relativeTime } from '@/lib/format'
import type { Business, BusinessAd } from '@/services/types'

/** One business ad: photo, title, offer, text. `business` adds a link to its page (Discover). */
export function AdCard({ ad, business, actions, sponsored = false }: { ad: BusinessAd; business?: Business; actions?: ReactNode; sponsored?: boolean }) {
  return (
    <GlassCard as="article" className="overflow-hidden">
      {ad.photos[0] && <img src={ad.photos[0]} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />}
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {sponsored && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">
              <Megaphone className="size-3" aria-hidden />
              {t('Tài trợ')}
            </span>
          )}
          {business && (
            <Link to={`/b/${business.slug}`} className="font-semibold text-foreground hover:underline">
              {business.name}
            </Link>
          )}
          <span>{relativeTime(ad.createdAt)}</span>
        </div>
        <h3 className="font-display text-lg leading-snug">{ad.title}</h3>
        {ad.offer && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold">
            <Tag className="size-3.5" aria-hidden />
            {ad.offer}
          </p>
        )}
        <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{ad.content}</p>
        {ad.photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {ad.photos.slice(1).map((url) => (
              <img key={url} src={url} alt="" className="size-16 shrink-0 rounded-lg object-cover" loading="lazy" />
            ))}
          </div>
        )}
        {ad.moderation && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {t('Đã bị ẩn do vi phạm')}
            {ad.moderation.reason && `: ${ad.moderation.reason}`}
          </p>
        )}
        {actions}
      </div>
    </GlassCard>
  )
}
