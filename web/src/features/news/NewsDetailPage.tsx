import { ArrowLeft, Bookmark, ExternalLink, MapPin, Newspaper, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNewsItem, useToggleSaveNews } from '@/features/news/hooks'
import { newsOrigin } from '@/features/news/labels'
import { ReportMenu } from '@/features/report/ReportMenu'
import { t } from '@/i18n'
import { REGION_LABELS, relativeTime } from '@/lib/format'
import { newsLayout, youtubeId } from '@/lib/newsLayout'
import { cn } from '@/lib/utils'
import { newsService } from '@/services'
import { useAuthStore } from '@/store'

/**
 * A travel news post on its own page: headline, cover (or the video), the
 * paragraphs the AI wrote from the original with the original's pictures
 * between them, and the link back to the source at the end.
 */
export function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: item, isPending, isError, error } = useNewsItem(id)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const save = useToggleSaveNews()

  // One count per visit to the page.
  useEffect(() => {
    if (item?._id) newsService.recordClick(item._id)
  }, [item?._id])

  if (isPending) return <NewsDetailSkeleton />

  if (isError || !item) {
    return (
      <PageContainer>
        <EmptyState
          icon={Newspaper}
          title={t('Không tìm thấy tin')}
          description={(error as Error | null)?.message ?? t('Tin này có thể đã được gỡ.')}
          action={
            <Button asChild variant="outline">
              <Link to="/feed?tab=news">{t('Xem tin du lịch')}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const layout = newsLayout(item.content ?? [], item.images)
  const video = item.kind === 'video' ? youtubeId(item.url) : null
  const origin = newsOrigin(item)

  return (
    <PageContainer>
      <article className="mx-auto max-w-3xl">
        <Link to="/feed?tab=news" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('Tin du lịch')}
        </Link>

        <header className="animate-fade-rise mt-6">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-np-teal/15 px-2 py-0.5 text-[13px] font-medium text-np-teal">
              <Newspaper className="size-3.5" aria-hidden />
              {t('Tin du lịch')}
            </span>
            <span className="text-sm text-foreground">{origin}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
            {item.regions.map((region) => (
              <span key={region} className="contents">
                <span aria-hidden>·</span>
                <span>{REGION_LABELS[region]}</span>
              </span>
            ))}
          </p>

          <h1 className="mt-5 font-display text-3xl leading-tight tracking-tight sm:text-4xl">{item.title}</h1>

          {item.summary && <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{item.summary}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isAuthenticated && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => save.mutate(item._id)}
                disabled={save.isPending}
                aria-pressed={Boolean(item.savedByMe)}
              >
                <Bookmark className={cn(item.savedByMe && 'fill-current text-np-teal')} />
                {item.savedByMe ? t('Đã lưu') : t('Lưu tin')}
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {item.kind === 'video' ? t('Xem trên YouTube') : t('Đọc bài gốc')}
              </a>
            </Button>
            <div className="ml-auto">
              <ReportMenu targetType="news" targetId={item._id} ownerId={`news:${item.sourceId}`} label={t('Thêm thao tác cho tin này')} />
            </div>
          </div>
        </header>

        {video ? (
          <div className="animate-fade-rise-delay mt-8 aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video}`}
              title={item.title}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          </div>
        ) : (
          layout.cover && <Photo url={layout.cover} className="animate-fade-rise-delay mt-8 aspect-[16/9]" eager />
        )}

        <div className="mt-8 space-y-6">
          {layout.blocks.map((block, index) =>
            block.kind === 'text' ? (
              <p key={index} className="text-[17px] leading-[1.8] text-foreground/90">
                {block.text}
              </p>
            ) : (
              <Photo key={index} url={block.url} className="aspect-[3/2]" />
            ),
          )}
        </div>

        {layout.gallery.length > 0 && (
          <section className="mt-10" aria-label={t('Ảnh của bài')}>
            <h2 className="font-display text-xl tracking-tight">{t('Thêm ảnh')}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {layout.gallery.map((url) => (
                <Photo key={url} url={url} className="aspect-square" />
              ))}
            </div>
          </section>
        )}

        {item.destinations.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label={t('Địa điểm trong bài')}>
            {item.destinations.map((name) => (
              <li key={name} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
                <MapPin className="size-3.5 text-np-teal" aria-hidden />
                {name}
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-10 rounded-2xl border border-border p-5">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-np-teal" aria-hidden />
            <span>
              {(item.content?.length ?? 0) > 0
                ? t('Bài do AI của ChillnGo viết lại từ bài gốc của {source}. Ảnh thuộc về nguồn.', { source: origin })
                : t('Tin tổng hợp từ {source}. Mở bài gốc để đọc đầy đủ.', { source: origin })}
            </span>
          </p>
          {item.originalTitle && item.originalTitle !== item.title && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('Tiêu đề gốc:')} <span className="text-foreground">{item.originalTitle}</span>
            </p>
          )}
          <Button asChild className="mt-4 rounded-full">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {item.kind === 'video' ? t('Xem trên YouTube') : t('Đọc bài gốc')}
            </a>
          </Button>
        </footer>
      </article>
    </PageContainer>
  )
}

/** A picture served by the source; one the source no longer serves disappears instead of showing a broken frame. */
function Photo({ url, className, eager = false }: { url: string; className?: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn('block overflow-hidden rounded-2xl bg-white/5', className)}>
      <img
        src={url}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-full object-cover"
      />
    </a>
  )
}

function NewsDetailSkeleton() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-6 h-5 w-64" />
        <Skeleton className="mt-5 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <Skeleton className="mt-8 aspect-[16/9] w-full rounded-2xl" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </PageContainer>
  )
}
