import { Bookmark, Newspaper, Pin, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { ReportMenu } from '@/features/report/ReportMenu'
import { useToggleSaveNews } from '@/features/news/hooks'
import { newsOrigin } from '@/features/news/labels'
import { t } from '@/i18n'
import { REGION_LABELS, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/services/types'
import { useAuthStore } from '@/store'

/**
 * A travel news post in the Newsfeed, shaped like a journey card: cover on the
 * left, headline and summary on the right. It opens the post's own page
 * (/news/:id); the original article is linked from there.
 */
export function NewsCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const save = useToggleSaveNews()
  // A picture the source no longer serves leaves a text-only card.
  const [broken, setBroken] = useState(false)
  const cover = item.imageUrl && !broken ? item.imageUrl : null
  const to = `/news/${item._id}`

  return (
    <GlassCard as="article" interactive className="overflow-hidden">
      {/* GlassCard wraps its children in a layer of its own, so the row is laid out here. */}
      {/* Same frame as a journey card (TripCard): fixed height from `md` up, cover at 16:10. */}
      <div className={cn(!compact && 'md:flex md:h-64')}>
        {cover && (
          <Link
            to={to}
            tabIndex={-1}
            aria-hidden
            className={cn(
              'group relative block shrink-0 overflow-hidden bg-white/5',
              compact ? 'aspect-[16/9] w-full' : 'aspect-[16/10] w-full md:aspect-auto md:h-full md:w-[25.6rem]',
            )}
          >
            <img
              src={cover}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none absolute inset-0"
            />
            {item.kind === 'video' && (
              <PlayCircle className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-lg" aria-hidden />
            )}
          </Link>
        )}

        <div className={cn('flex min-w-0 flex-1 flex-col gap-3 p-5', !compact && 'md:overflow-hidden')}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-np-teal/15 px-2 py-0.5 text-[13px] font-medium text-np-teal">
              <Newspaper className="size-3.5" aria-hidden />
              {t('Tin du lịch')}
            </span>
            {item.pinned && (
              <span className="inline-flex items-center gap-1 text-np-cream">
                <Pin className="size-3.5" aria-hidden />
                {t('Đã ghim')}
              </span>
            )}
            <span className="truncate text-sm text-foreground">{newsOrigin(item)}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.publishedAt} className="shrink-0">
              {relativeTime(item.publishedAt)}
            </time>
          </p>

          <Link to={to} className="group block space-y-2">
            <h3 className={cn('line-clamp-2 font-display leading-tight tracking-tight group-hover:underline', compact ? 'text-xl' : 'text-2xl')}>{item.title}</h3>
            {item.summary && (
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
            )}
          </Link>

          <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {item.regions.map((region) => (
              <span key={region} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {REGION_LABELS[region]}
              </span>
            ))}
            {item.destinations.slice(0, compact ? 1 : 3).map((name) => (
              <span key={name} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                📍 {name}
              </span>
            ))}
            <div className="-mr-2 ml-auto flex items-center gap-1">
              {isAuthenticated && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => save.mutate(item._id)}
                  disabled={save.isPending}
                  aria-pressed={Boolean(item.savedByMe)}
                  aria-label={item.savedByMe ? t('Bỏ lưu tin này') : t('Lưu tin này')}
                  title={item.savedByMe ? t('Bỏ lưu tin này') : t('Lưu tin này')}
                >
                  <Bookmark className={cn(item.savedByMe && 'fill-current text-np-teal')} />
                </Button>
              )}
              <ReportMenu targetType="news" targetId={item._id} ownerId={`news:${item.sourceId}`} label={t('Thêm thao tác cho tin này')} />
            </div>
          </footer>
        </div>
      </div>
    </GlassCard>
  )
}
