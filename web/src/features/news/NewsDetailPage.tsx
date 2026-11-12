import { Bookmark, CalendarRange, ExternalLink, MapPin, Newspaper, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { MapPreview } from '@/components/MapPreview'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DimensionalSwitchSlider } from '@/components/ui/dimensional-switch-slider'
import { Skeleton } from '@/components/ui/skeleton'
import { useNewsItem, useToggleSaveNews } from '@/features/news/hooks'
import { newsOrigin } from '@/features/news/labels'
import { ReportMenu } from '@/features/report/ReportMenu'
import { t } from '@/i18n'
import { REGION_LABELS, formatLongDate, relativeTime } from '@/lib/format'
import { newsLayout, youtubeId } from '@/lib/newsLayout'
import { cn } from '@/lib/utils'
import { newsService } from '@/services'
import { useAuthStore } from '@/store'

/**
 * A travel news post on its own page, built on the journey page's frame
 * (PostDetailPage): header on the left with the source where the author is,
 * the picture slider, three facts, then the post in a card beside the map of
 * the places it mentions. The post is the AI's writing from the original; the
 * link back to the source closes the page.
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

  const content = item.content ?? []
  // The slider shows every picture, so the text only takes the ones after the cover.
  const layout = newsLayout(content, item.images)
  const video = item.kind === 'video' ? youtubeId(item.url) : null
  const origin = newsOrigin(item)
  const places = item.places ?? []
  const openLabel = item.kind === 'video' ? t('Xem trên YouTube') : t('Đọc bài gốc')
  // Each paragraph with the picture that follows it, like a stop with its photo.
  const parts = layout.blocks.reduce<{ text: string; image?: string }[]>((list, block) => {
    if (block.kind === 'text') list.push({ text: block.text })
    else if (list.length > 0) list[list.length - 1].image = block.url
    return list
  }, [])

  const saveButton = isAuthenticated && (
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
  )

  return (
    <PageContainer>
      <article>
        {/* Header */}
        <header className="animate-fade-rise">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.regions.map((region) => (
              <span key={region} className="contents">
                <span>{REGION_LABELS[region]}</span>
                <span aria-hidden>·</span>
              </span>
            ))}
            <Link to="/feed?tab=news" className="inline-flex items-center gap-1 text-np-teal hover:underline">
              <Newspaper className="size-3.5" aria-hidden />
              {t('Tin du lịch')}
            </Link>
          </div>

          <h1 className="mt-5 max-w-[22ch] font-display text-4xl tracking-tight">{item.title}</h1>

          {item.summary && <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">{item.summary}</p>}

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback>{origin.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span>
                <span className="flex items-center gap-1.5 text-sm group-hover:underline">{origin}</span>
                <time dateTime={item.publishedAt} className="block text-xs text-muted-foreground">
                  {t('Đăng {time}', { time: relativeTime(item.publishedAt) })}
                </time>
              </span>
            </a>
            <div className="ml-auto flex items-center gap-2">
              {saveButton}
              <ReportMenu targetType="news" targetId={item._id} ownerId={`news:${item.sourceId}`} label={t('Thêm thao tác cho tin này')} />
            </div>
          </div>

          {item.destinations.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label={t('Địa điểm trong bài')}>
              {item.destinations.map((name) => (
                <li key={name} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  {name}
                </li>
              ))}
            </ul>
          )}
        </header>

        {/* The video, or every picture of the post */}
        {video ? (
          <div className="animate-fade-rise-delay mt-10 aspect-video w-full overflow-hidden rounded-2xl bg-black">
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
          item.images.length > 0 && (
            <DimensionalSwitchSlider
              key={item.images.join('|')}
              items={item.images.map((image) => ({ image }))}
              label={t('Ảnh của bài')}
              className="animate-fade-rise-delay mt-10"
              stageClassName="aspect-[16/10] w-full rounded-2xl sm:aspect-[21/9]"
            />
          )
        )}

        {/* Key facts */}
        <dl className="animate-fade-rise-delay mt-8 grid gap-4 sm:grid-cols-3">
          <Fact icon={<Newspaper className="size-4" />} label={t('Nguồn')} value={origin} />
          <Fact icon={<CalendarRange className="size-4" />} label={t('Ngày đăng')} value={formatLongDate(item.publishedAt)} />
          <Fact
            icon={<MapPin className="size-4" />}
            label={t('Khu vực')}
            value={item.regions.map((region) => REGION_LABELS[region]).join(', ') || t('Chưa rõ')}
          />
        </dl>

        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* The post */}
          <div className="min-w-0 space-y-6">
            <h2 className="font-display text-3xl">{t('Nội dung bài viết')}</h2>
            <GlassCard as="section" className="p-6 sm:p-8">
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div>
                  <p className="text-sm text-muted-foreground">{t('Tin du lịch')}</p>
                  <h3 className="mt-1 font-display text-xl">{item.title}</h3>
                  <time dateTime={item.publishedAt} className="mt-1 block text-sm text-muted-foreground">
                    {formatLongDate(item.publishedAt)}
                  </time>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('Nguồn')} <span className="text-foreground">{origin}</span>
                </p>
              </header>

              {parts.length > 0 ? (
                <ol className="mt-8 space-y-0">
                  {parts.map((part, index) => (
                    <li key={index} className="relative flex gap-4 pb-8 last:pb-0">
                      {index < parts.length - 1 && <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-border" />}
                      <span className="relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-medium">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="leading-relaxed">{part.text}</p>
                        {part.image && <Photo url={part.image} className="mt-3 aspect-[16/10] w-full max-w-md rounded-xl" />}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                  {t('Tin tổng hợp từ {source}. Mở bài gốc để đọc đầy đủ.', { source: origin })}
                </p>
              )}

              {layout.gallery.length > 0 && (
                <div className="no-scrollbar -mx-6 mt-6 flex gap-3 overflow-x-auto px-6 sm:-mx-8 sm:px-8">
                  {layout.gallery.map((url) => (
                    <Photo key={url} url={url} className="h-32 w-44 shrink-0 rounded-2xl sm:h-40 sm:w-56" />
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Map of the places, and where the post comes from */}
          <aside className="min-w-0 lg:sticky lg:top-32">
            {places.length > 0 && (
              <>
                <h2 className="font-display text-3xl">{t('Bản đồ địa điểm')}</h2>
                <MapPreview
                  pins={places.map((place) => ({ id: place.name, lat: place.lat, lng: place.lng, label: place.name }))}
                  className="mt-6 h-[22rem] w-full"
                  label={t('Bản đồ các địa điểm trong bài {title}', { title: item.title })}
                />
              </>
            )}
            <div className={cn('rounded-2xl border border-border p-5', places.length > 0 && 'mt-6')}>
              <h2 className={cn('font-display', places.length > 0 ? 'text-xl' : 'text-3xl')}>{t('Nguồn bài viết')}</h2>
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-np-teal" aria-hidden />
                <span>
                  {content.length > 0
                    ? t('Bài do AI của ChillnGo viết lại từ bài gốc của {source}. Ảnh thuộc về nguồn.', { source: origin })
                    : t('Tin tổng hợp từ {source}. Mở bài gốc để đọc đầy đủ.', { source: origin })}
                </span>
              </p>
              {item.originalTitle && item.originalTitle !== item.title && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('Tiêu đề gốc:')} <span className="text-foreground">{item.originalTitle}</span>
                </p>
              )}
              <Button asChild variant="outline" className="mt-4 rounded-full">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  {openLabel}
                </a>
              </Button>
            </div>
          </aside>
        </div>

        {/* Actions, where a journey has its like, comment and save bar */}
        <div className="mt-12 flex flex-wrap items-center gap-2 rounded-2xl border border-border p-4">
          {saveButton}
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {openLabel}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto rounded-full">
            <Link to="/feed?tab=news">{t('Xem tin du lịch')}</Link>
          </Button>
        </div>
      </article>
    </PageContainer>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 text-base">{value}</dd>
    </div>
  )
}

/** A picture served by the source; one the source no longer serves disappears instead of showing a broken frame. */
function Photo({ url, className }: { url: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn('np-media group block overflow-hidden bg-np-well', className)}>
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    </a>
  )
}

function NewsDetailSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-3.5 w-48" />
      <Skeleton className="mt-4 h-12 w-full max-w-3xl" />
      <Skeleton className="mt-3 h-12 w-full max-w-xl" />
      <Skeleton className="mt-6 h-4 w-full max-w-2xl" />
      <div className="mt-7 flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="mt-10 aspect-[21/9] w-full rounded-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </PageContainer>
  )
}
