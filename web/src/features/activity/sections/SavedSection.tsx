import { Bookmark, MapPin, Newspaper } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ActivityTabs, Empty, ErrorPanel, ListSkeleton, NotAvailable, SectionHeader } from '@/features/activity/components'
import { journeyStats } from '@/features/activity/format'
import { useSavedJourneys, useUnsave } from '@/features/activity/hooks'
import { useSavedNews } from '@/features/news/hooks'
import { NewsCard } from '@/features/news/NewsCard'
import { t } from '@/i18n'

export function SavedSection() {
  return (
    <>
      <SectionHeader title={t('Đã lưu')} description={t('Những hành trình và tin du lịch bạn đã lưu để xem lại. Chỉ mình bạn thấy được mục này.')} />
      <ActivityTabs
        label={t('Loại đã lưu')}
        tabs={[
          { value: 'journeys', label: t('Hành trình'), content: <SavedJourneys /> },
          { value: 'news', label: t('Tin du lịch'), content: <SavedNews /> },
          {
            value: 'places',
            label: t('Địa điểm'),
            content: (
              <NotAvailable
                icon={MapPin}
                feature={t('tính năng lưu địa điểm')}
                description={t('Tính năng lưu từng địa điểm sắp có. Hiện tại, hãy lưu hành trình có địa điểm đó.')}
              />
            ),
          },
        ]}
      />
    </>
  )
}

function SavedJourneys() {
  const saved = useSavedJourneys()
  const unsave = useUnsave()

  if (saved.isPending) return <ListSkeleton rows={6} media />
  if (saved.isError) return <ErrorPanel error={saved.error} onRetry={() => void saved.refetch()} />
  if (saved.data.length === 0) {
    return (
      <Empty
        icon={Bookmark}
        title={t('Chưa lưu gì')}
        description={t('Bấm biểu tượng lưu ở một hành trình để giữ nó ở đây xem sau.')}
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/discover">{t('Khám phá hành trình')}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {saved.data.map((post) => (
        <li key={post._id} className="liquid-glass group relative flex flex-col overflow-hidden rounded-2xl">
          <Link to={`/posts/${post._id}`} className="block">
            <div className="aspect-[16/10] overflow-hidden bg-np-well">
              <img
                src={post.coverUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </div>
            <div className="p-4">
              <p className="line-clamp-2 font-display text-lg leading-snug text-np-cream group-hover:underline">{post.title}</p>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                {t('của {name}', { name: post.author.displayName })} · {journeyStats(post)}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => unsave.mutate(post._id)}
            disabled={unsave.isPending && unsave.variables === post._id}
            aria-label={t('Bỏ lưu {title}', { title: post.title })}
            title={t('Bỏ lưu')}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-np-canopy/75 text-np-cream transition-colors hover:bg-np-canopy disabled:opacity-50"
          >
            <Bookmark className="size-4 fill-current" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function SavedNews() {
  const saved = useSavedNews()

  if (saved.isPending) return <ListSkeleton rows={4} />
  if (saved.isError) return <ErrorPanel error={saved.error} onRetry={() => void saved.refetch()} />
  if (saved.data.length === 0) {
    return (
      <Empty
        icon={Newspaper}
        title={t('Chưa lưu tin nào')}
        description={t('Bấm biểu tượng lưu ở một tin du lịch trên Newsfeed để giữ nó ở đây đọc sau.')}
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/feed?tab=news">{t('Xem tin du lịch')}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {saved.data.map((item) => (
        <NewsCard key={item._id} item={{ ...item, savedByMe: true }} compact />
      ))}
    </div>
  )
}
