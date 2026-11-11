import { useQuery } from '@tanstack/react-query'
import { Compass, Newspaper, Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckInCard } from '@/features/checkin/CheckInCard'
import { LivestreamCard } from '@/features/livestream/LivestreamCard'
import { LiveNowStrip } from '@/features/livestream/LiveNowStrip'
import { ReplayCard } from '@/features/livestream/ReplayCard'
import { useNews } from '@/features/news/hooks'
import { NewsCard } from '@/features/news/NewsCard'
import { PostComposer } from '@/features/trip-post/components/PostComposer'
import { useFeed } from '@/features/trip-post/hooks'
import { t } from '@/i18n'
import { interleave } from '@/lib/feedMix'
import { REGION_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'
import { checkinService, livestreamService, socialService } from '@/services'
import type { CheckIn } from '@/services/checkin.service'
import type { Livestream } from '@/services/livestream.service'
import type { NewsItem, Region, TripPostWithAuthor } from '@/services/types'
import { useAuthStore, useViewerId } from '@/store'

type FeedItem =
  | { kind: 'post'; at: string; post: TripPostWithAuthor }
  | { kind: 'checkin'; at: string; checkin: CheckIn }
  | { kind: 'replay'; at: string; stream: Livestream }

const TABS = ['for-you', 'following', 'news'] as const
type FeedTab = (typeof TABS)[number]
const REGIONS: Region[] = ['north', 'central', 'south', 'islands', 'overseas']

/**
 * Three tabs. "Dành cho bạn": the timeline with a travel news item after
 * every three entries. "Đang theo dõi": the timeline alone. "Tin du lịch":
 * news only, by region. The tab and the region live in the URL.
 */
export function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const tabParam = searchParams.get('tab') as FeedTab | null
  const tab: FeedTab = tabParam && TABS.includes(tabParam) ? tabParam : 'for-you'
  const regionParam = searchParams.get('region') as Region | null
  const region = regionParam && REGIONS.includes(regionParam) ? regionParam : undefined

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('Newsfeed')}
        description={
          tab === 'news'
            ? t('Tin tức du lịch mới nhất, ChillnGo tổng hợp và tóm tắt từ báo chí, YouTube và mạng xã hội.')
            : isAuthenticated
              ? t('Hành trình và check-in mới nhất từ bạn và những người bạn đang theo dõi, kèm tin du lịch mới.')
              : t('Những hành trình và check-in mới nhất trên ChillnGo, kèm tin du lịch mới. Đăng nhập để chỉ xem người bạn theo dõi.')
        }
        action={
          <GlassButton asChild size="md" tone="sunset">
            <Link to="/discover">
              <Compass />
              {t('Khám phá thêm')}
            </Link>
          </GlassButton>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParam('tab', value === 'for-you' ? null : value)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList aria-label={t('Chọn nội dung newsfeed')} className="np-well border-transparent">
            <TabsTrigger value="for-you">{t('Dành cho bạn')}</TabsTrigger>
            <TabsTrigger value="following">{t('Đang theo dõi')}</TabsTrigger>
            <TabsTrigger value="news">{t('Tin du lịch')}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="for-you">
          <Timeline withNews />
        </TabsContent>
        <TabsContent value="following">
          <Timeline withNews={false} />
        </TabsContent>
        <TabsContent value="news">
          <NewsTab region={region} onRegion={(r) => setParam('region', r ?? null)} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

/** "Tin du lịch": news only, newest first, by region, more on demand. */
function NewsTab({ region, onRegion }: { region?: Region; onRegion: (region?: Region) => void }) {
  const news = useNews(region)
  const items = news.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Lọc theo vùng')}>
        <RegionChip active={!region} onClick={() => onRegion(undefined)}>
          {t('Tất cả')}
        </RegionChip>
        {REGIONS.map((r) => (
          <RegionChip key={r} active={region === r} onClick={() => onRegion(r)}>
            {REGION_LABELS[r]}
          </RegionChip>
        ))}
      </div>

      {news.isPending && <TripCardSkeleton />}
      {news.isError && <EmptyState title={t('Không tải được tin du lịch')} description={(news.error as Error).message} />}
      {news.isSuccess && items.length === 0 && (
        <EmptyState
          icon={Newspaper}
          title={t('Chưa có tin du lịch')}
          description={
            region ? t('Chưa có tin nào cho vùng này. Thử chọn vùng khác.') : t('Tin du lịch mới sẽ xuất hiện ở đây khi ChillnGo cập nhật từ các nguồn.')
          }
        />
      )}
      {items.length > 0 && (
        <div className="animate-fade-rise flex flex-col gap-6">
          {items.map((item) => (
            <NewsCard key={item._id} item={item} />
          ))}
        </div>
      )}
      {news.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" className="rounded-full" onClick={() => void news.fetchNextPage()} disabled={news.isFetchingNextPage}>
            {news.isFetchingNextPage ? t('Đang tải…') : t('Xem thêm tin')}
          </Button>
        </div>
      )}
    </div>
  )
}

function RegionChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        active ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Trip posts and photo check-ins (from the API), newest first. Signed in:
 * yours and the people you follow. Signed out: everyone's. `withNews`: one
 * news item after every three entries.
 */
function Timeline({ withNews }: { withNews: boolean }) {
  const { data: posts, isPending, isError, error } = useFeed()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const viewerId = useViewerId()

  const following = useQuery({
    queryKey: ['following', viewerId],
    queryFn: () => socialService.getFollowingIds(viewerId as string),
    enabled: Boolean(viewerId),
  })
  const authors = viewerId ? [viewerId, ...(following.data ?? [])] : undefined
  const checkins = useQuery({
    queryKey: ['checkins', 'feed', authors?.join(',') ?? 'everyone'],
    queryFn: () => checkinService.listCheckIns(authors),
    enabled: !viewerId || following.isSuccess,
  })

  // Who is live right now. Polled: the list changes as streams start and end.
  const live = useQuery({
    queryKey: ['livestreams', 'feed', authors?.join(',') ?? 'everyone'],
    queryFn: () => livestreamService.listLive(authors),
    enabled: !viewerId || following.isSuccess,
    refetchInterval: 20_000,
  })

  // Streams that are over and were recorded: in the timeline, to watch again.
  const replays = useQuery({
    queryKey: ['livestreams', 'replays', 'feed', authors?.join(',') ?? 'everyone'],
    queryFn: () => livestreamService.listReplays(authors),
    enabled: !viewerId || following.isSuccess,
  })

  const items = useMemo<FeedItem[]>(() => {
    const all: FeedItem[] = [
      ...(posts ?? []).map((post) => ({ kind: 'post' as const, at: post.createdAt, post })),
      // A check-in feed that fails to load (API down) should not hide the posts.
      ...(checkins.data ?? []).map((checkin) => ({ kind: 'checkin' as const, at: checkin.createdAt, checkin })),
      ...(replays.data?.items ?? []).map((stream) => ({ kind: 'replay' as const, at: stream.endedAt ?? stream.startedAt, stream })),
    ]
    return all.sort((a, b) => b.at.localeCompare(a.at))
  }, [posts, checkins.data, replays.data])

  // The first page of news is enough to mix in. News that fails to load
  // (API down) leaves the timeline as it was.
  const news = useNews(undefined, withNews)
  const newsItems = useMemo<NewsItem[]>(() => (withNews ? (news.data?.pages[0]?.items ?? []) : []), [withNews, news.data])
  const mixed = useMemo(() => interleave(items, newsItems, 3), [items, newsItems])

  return (
    <>
      {isAuthenticated && user && (
        <div className="animate-fade-rise mb-8">
          <PostComposer user={user} />
        </div>
      )}

      <LiveNowStrip />

      {isPending && (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && <EmptyState title={t('Không tải được newsfeed')} description={(error as Error).message} />}

      {live.data && live.data.length > 0 && (
        <div className="mb-6 flex flex-col gap-6">
          {live.data.map((stream) => (
            <LivestreamCard key={stream._id} stream={stream} featured />
          ))}
        </div>
      )}

      {posts && mixed.length === 0 && !live.data?.length && (
        <EmptyState
          icon={Users}
          title={t('Newsfeed đang trống')}
          description={t('Bạn chưa theo dõi ai, hoặc những người bạn theo dõi chưa đăng gì. Hãy check-in chuyến đi của bạn, hoặc tìm vài người đi cùng gu ở trang Khám phá.')}
          action={
            <GlassButton asChild size="lg">
              <Link to="/discover">{t('Khám phá hành trình')}</Link>
            </GlassButton>
          }
        />
      )}

      {posts && mixed.length > 0 && (
        <div className="animate-fade-rise-delay flex flex-col gap-6">
          {mixed.map((entry) => {
            if (entry.kind === 'news') return <NewsCard key={`news-${entry.value._id}`} item={entry.value} />
            const item = entry.value
            return item.kind === 'post' ? (
              <TripCard key={`post-${item.post._id}`} post={item.post} />
            ) : item.kind === 'replay' ? (
              <ReplayCard key={`replay-${item.stream._id}`} stream={item.stream} showHost featured />
            ) : (
              <CheckInCard key={`checkin-${item.checkin._id}`} checkin={item.checkin} viewerId={viewerId} />
            )
          })}
        </div>
      )}
    </>
  )
}
