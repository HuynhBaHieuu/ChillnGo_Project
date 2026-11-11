import { Bookmark, ExternalLink, Newspaper, Pin, PlayCircle } from 'lucide-react'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { ReportMenu } from '@/features/report/ReportMenu'
import { useToggleSaveNews } from '@/features/news/hooks'
import { newsOrigin } from '@/features/news/labels'
import { t } from '@/i18n'
import { REGION_LABELS, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { newsService } from '@/services'
import type { NewsItem } from '@/services/types'
import { useAuthStore } from '@/store'

/**
 * A travel news item in the Newsfeed. Only the title, a short summary and a
 * picture are shown: reading it means opening the original.
 */
export function NewsCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const save = useToggleSaveNews()
  const open = () => newsService.recordClick(item._id)

  return (
    <GlassCard as="article" className="overflow-hidden p-0">
      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={open} className="group block">
        {item.imageUrl && !compact && (
          <div className="relative h-52 w-full overflow-hidden bg-np-well sm:h-72 lg:h-80">
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
            {item.kind === 'video' && (
              <PlayCircle className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-lg" aria-hidden />
            )}
          </div>
        )}
        <div className="space-y-2 p-4 pb-2 sm:px-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-np-teal/15 px-2 py-0.5 font-medium text-np-teal">
              <Newspaper className="size-3.5" aria-hidden />
              {t('Tin du lịch')}
            </span>
            {item.pinned && (
              <span className="inline-flex items-center gap-1 text-np-cream">
                <Pin className="size-3.5" aria-hidden />
                {t('Đã ghim')}
              </span>
            )}
            <span className="truncate">{newsOrigin(item)}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
          </p>
          <h3 className="font-display text-lg leading-snug text-np-cream group-hover:underline sm:text-xl">{item.title}</h3>
          {item.summary && <p className={cn('text-[15px] leading-relaxed text-muted-foreground', compact ? 'line-clamp-2' : 'line-clamp-4')}>{item.summary}</p>}
        </div>
      </a>
      <footer className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
        {item.regions.map((region) => (
          <span key={region} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            {REGION_LABELS[region]}
          </span>
        ))}
        {item.destinations.slice(0, 3).map((name) => (
          <span key={name} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            📍 {name}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={open}>
              <ExternalLink />
              {item.kind === 'video' ? t('Xem video') : t('Đọc bài gốc')}
            </a>
          </Button>
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
    </GlassCard>
  )
}
