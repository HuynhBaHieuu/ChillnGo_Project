import { useQuery } from '@tanstack/react-query'
import { SearchX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { CardCarousel } from '@/features/discovery-admin/components/CardCarousel'
import {
  DiscoverCard,
  DiscoverCardSkeleton,
} from '@/features/discovery-admin/components/DiscoverCard'
import { DiscoverHero } from '@/features/discovery-admin/components/DiscoverHero'
import { DiscoverSection } from '@/features/discovery-admin/components/DiscoverSection'
import {
  InterestGrid,
  type InterestTile,
} from '@/features/discovery-admin/components/InterestGrid'
import { PhotoTile } from '@/features/discovery-admin/components/PhotoTile'
import { ShareTripBanner } from '@/features/discovery-admin/components/ShareTripBanner'
import { TripOfTheYearBanner } from '@/features/discovery-admin/components/TripOfTheYearBanner'
import { REGIONS, REGION_LABELS, SEASON_LABELS } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { activityService, discoveryService } from '@/services'
import type { DiscoverFilters, Region, Season, TripPostWithAuthor } from '@/services/types'
import { useAuthStore, useViewerId } from '@/store'

/** Meteorological seasons, which is how the posts are tagged. */
function currentSeason(): Season {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/** A row only earns its place with at least this many cards. */
const MIN_ROW = 2

export function DiscoverPage() {
  const viewerId = useViewerId()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // ?q= opens Discover already searching (Your Activity → Search History links here).
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<DiscoverFilters>(() => ({
    ...discoveryService.DEFAULT_FILTERS,
    query: searchParams.get('q')?.slice(0, 120) ?? '',
  }))

  // A search counts once the user stops typing; it goes to their Search History.
  useEffect(() => {
    const query = filters.query.trim()
    if (!isAuthenticated || query.length < 2) return
    const timer = window.setTimeout(() => activityService.recordSearch('journey', query), 1500)
    return () => window.clearTimeout(timer)
  }, [filters.query, isAuthenticated])

  const isFiltering =
    filters.query.trim() !== '' || filters.region !== 'all' || filters.tags.length > 0

  // Every curated band reads from the unfiltered list, sorted by saves.
  const { data: allPosts, isPending: allPending } = useQuery({
    queryKey: qk.discover.list(discoveryService.DEFAULT_FILTERS, viewerId),
    queryFn: () => discoveryService.discoverPosts(discoveryService.DEFAULT_FILTERS, viewerId),
  })

  const { data: results, isPending: resultsPending } = useQuery({
    queryKey: qk.discover.list(filters, viewerId),
    queryFn: () => discoveryService.discoverPosts(filters, viewerId),
    enabled: isFiltering,
  })

  const [season] = useState(currentSeason)

  const bands = useMemo(() => {
    const posts = allPosts ?? []
    const byLikes = [...posts].sort((a, b) => b.likeCount - a.likeCount)
    const newest = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      top: posts[0] as TripPostWithAuthor | undefined,
      food: posts.filter((p) => p.tags.includes('ẩm thực')),
      loved: byLikes.slice(0, 8),
      inspiration: newest.slice(0, 6),
      seasonal: posts.filter((p) => p.season === season),
    }
  }, [allPosts, season])

  /**
   * The four most-used tags. Each is pictured by the trip that lists it
   * earliest among its own tags (so "ẩm thực" isn't shown with a beach),
   * the most saved winning ties; a cover is used at most once.
   */
  const interests = useMemo<InterestTile[]>(() => {
    const posts = allPosts ?? []
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    const used = new Set<string>()
    const tiles: InterestTile[] = []
    for (const [tag] of [...counts].sort((a, b) => b[1] - a[1])) {
      // `allPosts` is sorted by saves, so the stable sort keeps that as the tiebreak.
      const post = posts
        .filter((p) => p.tags.includes(tag) && !used.has(p.coverUrl))
        .sort((x, y) => x.tags.indexOf(tag) - y.tags.indexOf(tag))[0]
      if (!post) continue
      used.add(post.coverUrl)
      tiles.push({ tag, image: post.coverUrl })
      if (tiles.length === 4) break
    }
    return tiles
  }, [allPosts])

  /** One tile per region that has trips, pictured by its most-saved one. */
  const regions = useMemo(
    () =>
      REGIONS.flatMap((region) => {
        const post = (allPosts ?? []).find((p) => p.region === region)
        return post ? [{ region, image: post.coverUrl }] : []
      }),
    [allPosts],
  )

  // Tiles further down the page bring the reader back up to their results.
  const resultsRef = useRef<HTMLDivElement>(null)
  const scrollOnUpdate = useRef(false)
  useEffect(() => {
    if (!scrollOnUpdate.current) return
    scrollOnUpdate.current = false
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [filters])

  function patch(update: Partial<DiscoverFilters>, scroll = false) {
    scrollOnUpdate.current = scroll
    setFilters((prev) => ({ ...prev, ...update }))
  }

  function pickInterest(tag: string) {
    const only = filters.tags.length === 1 && filters.tags[0] === tag
    patch({ tags: only ? [] : [tag] }, true)
  }

  function pickRegion(region: Region) {
    patch({ region: filters.region === region ? 'all' : region }, true)
  }

  function reset() {
    setFilters({ ...discoveryService.DEFAULT_FILTERS })
  }

  const resultsTitle = filters.query.trim()
    ? `Kết quả cho “${filters.query.trim()}”`
    : 'Hành trình phù hợp'
  const resultsDescription = [
    filters.region !== 'all' && REGION_LABELS[filters.region],
    ...filters.tags,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PageContainer>
      <DiscoverHero
        query={filters.query}
        region={filters.region}
        onSearch={(query) => patch({ query })}
        onRegionChange={(region) => patch({ region })}
      />

      <div ref={resultsRef} className="scroll-mt-32" />

      {isFiltering && (
        <DiscoverSection
          title={resultsTitle}
          description={
            resultsPending
              ? 'Đang tìm hành trình…'
              : `${results?.length ?? 0} hành trình${resultsDescription ? ` · ${resultsDescription}` : ''}`
          }
          action={
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <X />
              Xóa bộ lọc
            </Button>
          }
          className="animate-fade-rise mt-16"
        >
          {resultsPending ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <DiscoverCardSkeleton key={i} />
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
              {results.map((post) => (
                <DiscoverCard key={post._id} post={post} chip={REGION_LABELS[post.region]} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="Không có hành trình nào khớp"
              description="Thử một từ khóa khác hoặc chọn khu vực “Tất cả”."
            />
          )}
        </DiscoverSection>
      )}

      {interests.length === 4 && (
        <InterestGrid
          tiles={interests}
          activeTags={filters.tags}
          onSelect={pickInterest}
          className="animate-fade-rise-delay mt-20"
        />
      )}

      {allPending && (
        <div className="mt-20 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <DiscoverCardSkeleton key={i} />
          ))}
        </div>
      )}

      {bands.food.length >= MIN_ROW && (
        <DiscoverSection title="Ăn ngon khắp ba miền" className="mt-20">
          <CardCarousel
            items={bands.food}
            getKey={(p) => p._id}
            renderItem={(p) => <DiscoverCard post={p} chip={REGION_LABELS[p.region]} />}
          />
        </DiscoverSection>
      )}

      {bands.loved.length >= MIN_ROW && (
        <DiscoverSection
          title="Hành trình được yêu thích"
          description="Được cộng đồng thả tim nhiều nhất"
          className="mt-20"
        >
          <CardCarousel
            items={bands.loved}
            getKey={(p) => p._id}
            renderItem={(p) => <DiscoverCard post={p} />}
          />
        </DiscoverSection>
      )}

      <ShareTripBanner className="mt-20" />

      {bands.inspiration.length >= MIN_ROW && (
        <GlassCard className="np-surface mt-20 px-5 py-10 sm:px-10">
          <DiscoverSection title="Cảm hứng cho chuyến đi tới">
            <CardCarousel
              items={bands.inspiration}
              getKey={(p) => p._id}
              itemClassName="basis-[80%] sm:basis-1/2 lg:basis-1/3"
              arrowClassName="top-[calc(10.4cqw-5px)]"
              renderItem={(p) => <DiscoverCard post={p} variant="wide" />}
            />
          </DiscoverSection>
        </GlassCard>
      )}

      {bands.seasonal.length >= MIN_ROW && (
        <DiscoverSection
          title={`Đi đâu ${SEASON_LABELS[season].toLowerCase()} này?`}
          description={`Những hành trình hợp nhất với ${SEASON_LABELS[season].toLowerCase()}`}
          className="mt-20"
        >
          <CardCarousel
            items={bands.seasonal}
            getKey={(p) => p._id}
            renderItem={(p) => <DiscoverCard post={p} chip={REGION_LABELS[p.region]} />}
          />
        </DiscoverSection>
      )}

      {regions.length >= MIN_ROW && (
        <DiscoverSection title="Điểm đến không thể bỏ lỡ" className="mt-20">
          <CardCarousel
            items={regions}
            getKey={(r) => r.region}
            arrowClassName="top-[calc(12.5cqw-8px)]"
            renderItem={(r) => (
              <PhotoTile
                label={REGION_LABELS[r.region]}
                image={r.image}
                active={filters.region === r.region}
                onClick={() => pickRegion(r.region)}
              />
            )}
          />
        </DiscoverSection>
      )}

      {bands.top && <TripOfTheYearBanner post={bands.top} className="mt-24" />}

      <section className="mt-20 max-w-5xl">
        <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
          ChillnGo: cộng đồng của những người mê xê dịch
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          ChillnGo giúp bạn đi những chuyến đi trọn vẹn hơn: đọc lịch trình thật từ người đã đi,
          xem chi phí từng điểm dừng, lưu lại những hành trình bạn thích và sao chép thành lịch
          trình của riêng mình chỉ với một chạm. Mỗi hành trình bạn chia sẻ lại trở thành cảm hứng
          cho chuyến đi tiếp theo của ai đó.
        </p>
      </section>
    </PageContainer>
  )
}
