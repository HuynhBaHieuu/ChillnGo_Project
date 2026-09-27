import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, MapIcon, SearchX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { MapPreview } from '@/components/MapPreview'
import type { MapPin } from '@/components/MapPreview'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FilterPanel } from '@/features/discovery-admin/components/FilterPanel'
import { qk } from '@/lib/queryKeys'
import { activityService, discoveryService } from '@/services'
import type { DiscoverFilters } from '@/services/types'
import { useAuthStore, useUiStore, useViewerId } from '@/store'

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

  const filterSheetOpen = useUiStore((s) => s.filterSheetOpen)
  const setFilterSheetOpen = useUiStore((s) => s.setFilterSheetOpen)
  const view = useUiStore((s) => s.discoverView)
  const setView = useUiStore((s) => s.setDiscoverView)

  // Fixed for the session; the ceiling only moves when the fixtures change.
  const ceiling = useMemo(() => discoveryService.costCeiling(), [])

  const { data: posts, isPending } = useQuery({
    queryKey: qk.discover.list(filters, viewerId),
    queryFn: () => discoveryService.discoverPosts(filters, viewerId),
  })

  /** One pin per post, at its first stop, weighted by saves. */
  const pins = useMemo<MapPin[]>(
    () =>
      (posts ?? [])
        .map((post): MapPin | null => {
          const first = post.days[0]?.locations[0]
          if (!first) return null
          return {
            id: post._id,
            lng: first.lng,
            lat: first.lat,
            label: post.title,
            weight: post.bookmarkCount,
          }
        })
        .filter((pin): pin is MapPin => pin !== null),
    [posts],
  )

  function reset() {
    setFilters({ ...discoveryService.DEFAULT_FILTERS })
  }

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      onReset={reset}
      costCeiling={ceiling}
    />
  )

  return (
    <PageContainer>
      <PageHeader
        title="Khám phá"
        description="Những hành trình được lưu nhiều nhất trên ChillnGo, sắp xếp theo số lượt lưu."
        action={
          <div className="flex items-center gap-3">
            {/* Mobile: filters live in a glass sheet */}
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-[1rem] py-[0.4286rem] text-sm uppercase tracking-[0.02em] transition-colors hover:border-white/40 lg:hidden"
                >
                  <SlidersHorizontal className="size-4" />
                  <span>Bộ lọc</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Bộ lọc</SheetTitle>
                </SheetHeader>
                {filterPanel}
              </SheetContent>
            </Sheet>

            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => {
                if (value === 'grid' || value === 'map') setView(value)
              }}
              aria-label="Kiểu hiển thị"
            >
              <ToggleGroupItem value="grid" aria-label="Dạng lưới">
                <LayoutGrid />
                <span className="hidden sm:inline">Lưới</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="map" aria-label="Dạng bản đồ">
                <MapIcon />
                <span className="hidden sm:inline">Bản đồ</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        {/* Desktop filter column */}
        <aside className="hidden lg:sticky lg:top-32 lg:block">
          <GlassCard className="np-surface p-6">{filterPanel}</GlassCard>
        </aside>

        <section>
          <p className="mb-6 text-sm text-muted-foreground">
            {isPending
              ? 'Đang tìm hành trình…'
              : `${posts?.length ?? 0} hành trình phù hợp`}
          </p>

          {isPending && view === 'grid' && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <TripCardSkeleton key={i} layout="grid" />
              ))}
            </div>
          )}

          {!isPending && posts?.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="Không có hành trình nào khớp"
              description="Thử nới ngân sách hoặc bỏ bớt một vài thẻ."
            />
          )}

          {!isPending && posts && posts.length > 0 && view === 'grid' && (
            <div className="animate-fade-rise-delay grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <TripCard key={post._id} post={post} layout="grid" />
              ))}
            </div>
          )}

          {!isPending && posts && posts.length > 0 && view === 'map' && (
            <div className="animate-fade-rise-delay space-y-6">
              <MapPreview
                pins={pins}
                cluster
                className="h-[32rem] w-full"
                label="Bản đồ các hành trình phù hợp"
              />
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => (
                  <TripCard key={post._id} post={post} layout="grid" />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  )
}
