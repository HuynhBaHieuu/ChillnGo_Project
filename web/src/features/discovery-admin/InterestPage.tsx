import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, SearchX, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { CardCarousel } from '@/features/discovery-admin/components/CardCarousel'
import {
  DiscoverCard,
  DiscoverCardSkeleton,
} from '@/features/discovery-admin/components/DiscoverCard'
import { DiscoverSection } from '@/features/discovery-admin/components/DiscoverSection'
import { FeaturedStory } from '@/features/discovery-admin/components/FeaturedStory'
import { InterestGrid } from '@/features/discovery-admin/components/InterestGrid'
import { InterestHero } from '@/features/discovery-admin/components/InterestHero'
import { PhotoTile } from '@/features/discovery-admin/components/PhotoTile'
import { StoryCard } from '@/features/discovery-admin/components/StoryCard'
import { interestHeadline, pickInterestTiles } from '@/features/discovery-admin/interests'
import { t, tx } from '@/i18n'
import { REGIONS, REGION_LABELS } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { discoveryService } from '@/services'
import { useViewerId } from '@/store'

/** Sections that need more than one trip to make sense stay hidden below this. */
const MIN_ROW = 2

/**
 * One interest (a tag) on its own page, reached from the "Khám phá theo sở
 * thích" tiles: a slideshow banner, the community's ranking, a featured story
 * with the newest trips, a photo-and-grid spread of the cheapest ones, the
 * regions it's found in, journal-style cards and the other interests.
 */
export function InterestPage() {
  const { tag: rawTag = '' } = useParams()
  const tag = decodeURIComponent(rawTag)
  const viewerId = useViewerId()

  const { data: all, isPending } = useQuery({
    queryKey: qk.discover.list(discoveryService.DEFAULT_FILTERS, viewerId),
    queryFn: () => discoveryService.discoverPosts(discoveryService.DEFAULT_FILTERS, viewerId),
  })

  const view = useMemo(() => {
    const posts = all ?? []
    // `all` is sorted by saves, so `trips` is the ranking.
    const trips = posts.filter((p) => p.tags.includes(tag))
    const byLikes = [...trips].sort((a, b) => b.likeCount - a.likeCount)
    const featured = byLikes[0]
    const newest = [...trips].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const cheapest = [...trips].sort((a, b) => a.totalEstCost - b.totalEstCost)
    return {
      trips,
      // Open on the trip the tag is most about, as the home tile does.
      covers: [
        ...new Set(
          [...trips]
            .sort((x, y) => x.tags.indexOf(tag) - y.tags.indexOf(tag))
            .map((p) => p.coverUrl),
        ),
      ].slice(0, 6),
      featured,
      newest: newest.filter((p) => p !== featured),
      // The spread's big photo is the second-most-liked, so it isn't the featured story again.
      spreadPhoto: byLikes[1],
      cheapest: cheapest.filter((p) => p !== byLikes[1]).slice(0, 4),
      regions: REGIONS.flatMap((region) => {
        const post = trips.find((p) => p.region === region)
        return post ? [{ region, image: post.coverUrl }] : []
      }),
      others: pickInterestTiles(posts, 4, [tag]),
    }
  }, [all, tag])

  const back = (
    <Link
      to="/discover"
      className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t('Khám phá')}
    </Link>
  )

  if (isPending) {
    return (
      <PageContainer>
        {back}
        <Skeleton className="h-[22rem] w-full rounded-xl sm:h-[28rem] lg:h-[31.25rem]" />
        <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <DiscoverCardSkeleton key={i} />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (view.trips.length === 0) {
    return (
      <PageContainer>
        {back}
        <EmptyState
          icon={SearchX}
          title={t('Chưa có hành trình nào về “{tag}”', { tag: tx(tag) })}
          description={t('Thử một sở thích khác bên dưới, hoặc là người đầu tiên chia sẻ.')}
        />
        {view.others.length > 0 && (
          <InterestGrid tiles={view.others} title={t('Sở thích khác')} className="mt-16" />
        )}
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {back}

      <InterestHero
        title={interestHeadline(tag)}
        subtitle={t('{n} hành trình gắn thẻ “{tag}”', { n: view.trips.length, tag: tx(tag) })}
        images={view.covers}
      />

      {/* The ranking, like an awards list: most saved first, numbered. */}
      <section className="mt-16">
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sunset text-sunset-foreground">
            <Trophy className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
              {t('Bảng xếp hạng cộng đồng')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('Những hành trình “{tag}” được lưu nhiều nhất', { tag: tx(tag) })}
            </p>
          </div>
        </div>
        <CardCarousel
          items={view.trips.slice(0, 10)}
          getKey={(p) => p._id}
          renderItem={(p) => (
            <DiscoverCard post={p} rank={view.trips.indexOf(p) + 1} chip={REGION_LABELS[p.region]} />
          )}
        />
      </section>

      {view.featured && view.newest.length >= MIN_ROW && (
        <DiscoverSection
          title={t('Câu chuyện nổi bật')}
          description={t('Được thả tim nhiều nhất, cùng những chuyến mới đăng')}
          className="mt-20"
        >
          <FeaturedStory post={view.featured} className="aspect-[4/3] sm:aspect-[16/7] lg:aspect-[16/5]" />
          <CardCarousel
            items={view.newest}
            getKey={(p) => p._id}
            className="mt-4"
            renderItem={(p) => <DiscoverCard post={p} chip={REGION_LABELS[p.region]} />}
          />
        </DiscoverSection>
      )}

      {view.spreadPhoto && view.cheapest.length >= MIN_ROW && (
        <section className="mt-20 grid gap-8 lg:grid-cols-2">
          <FeaturedStory post={view.spreadPhoto} className="aspect-[4/3] lg:aspect-auto lg:min-h-[36rem]" />
          <DiscoverSection title={t('Đi vừa túi tiền')} description={t('Từ chuyến rẻ nhất trở lên')}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              {view.cheapest.map((p) => (
                <DiscoverCard key={p._id} post={p} chip={REGION_LABELS[p.region]} />
              ))}
            </div>
          </DiscoverSection>
        </section>
      )}

      {view.regions.length > 0 && (
        <DiscoverSection title={t('Đi đâu để “{tag}”', { tag: tx(tag) })} className="mt-20">
          <CardCarousel
            items={view.regions}
            getKey={(r) => r.region}
            renderItem={(r) => (
              <PhotoTile
                to={`/discover?region=${r.region}&tag=${encodeURIComponent(tag)}`}
                label={REGION_LABELS[r.region]}
                image={r.image}
              />
            )}
          />
        </DiscoverSection>
      )}

      <DiscoverSection
        title={t('Nhật ký hành trình')}
        description={t('Lên kế hoạch cho chuyến tới, đọc từ người đã đi')}
        className="mt-20"
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {view.newest
            .concat(view.featured ? [view.featured] : [])
            .slice(0, 3)
            .map((p) => (
              <StoryCard key={p._id} post={p} />
            ))}
        </div>
      </DiscoverSection>

      {view.others.length > 0 && (
        <InterestGrid
          tiles={view.others}
          title={t('Sở thích khác')}
          description={t('Còn nhiều cách khác để lên đường.')}
          className="mt-20"
        />
      )}
    </PageContainer>
  )
}
