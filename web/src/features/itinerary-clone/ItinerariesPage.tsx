import { Compass, Map, PenLine, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyItineraries } from '@/features/itinerary-clone/hooks'
import { useMyJourneys } from '@/features/trip-post/hooks'
import { formatShortDate, formatVnd, relativeTime, tripLengthLabel } from '@/lib/format'
import { themeFromText, travelCover } from '@/lib/photos'
import { cn } from '@/lib/utils'
import type { ServerTripPost } from '@/services/post.service'
import type { ItineraryStatus } from '@/services/types'

const STATUS_LABELS: Record<ItineraryStatus, string> = {
  planning: 'Đang lên kế hoạch',
  confirmed: 'Đã chốt',
  completed: 'Đã đi',
}

type Tab = 'mine' | 'cloned'

/**
 * Hành trình của tôi: journeys you wrote yourself (published and drafts), and
 * the itineraries you cloned from other people's posts. The open tab lives in
 * `?tab=`, like the profile page's tabs.
 */
export function ItinerariesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'cloned' ? 'cloned' : 'mine'

  return (
    <PageContainer>
      <PageHeader
        title="Hành trình của tôi"
        description="Hành trình bạn tự đăng và những lịch trình bạn đã clone về. Sửa thứ tự ngày, ghép thêm ngày từ bài viết khác, và theo dõi tổng chi phí theo thời gian thực."
        action={
          <div className="flex flex-wrap gap-3">
            <GlassButton asChild size="lg" tone="sunset">
              <Link to="/posts/new">
                <Plus />
                Đăng hành trình
              </Link>
            </GlassButton>
            <GlassButton asChild size="lg">
              <Link to="/discover">
                <Compass />
                Tìm hành trình mới
              </Link>
            </GlassButton>
          </div>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          next.set('tab', value)
          setSearchParams(next, { replace: true })
        }}
      >
        <TabsList aria-label="Loại hành trình" className="np-well border-transparent">
          <TabsTrigger value="mine">Tôi đăng</TabsTrigger>
          <TabsTrigger value="cloned">Đã clone về</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          <MyJourneys />
        </TabsContent>
        <TabsContent value="cloned">
          <ClonedItineraries />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- tôi đăng */

function MyJourneys() {
  const { data: journeys, isPending, isError, error, refetch } = useMyJourneys()

  if (isPending) return <GridSkeleton />

  if (isError) {
    return (
      <EmptyState
        title="Không tải được hành trình của bạn"
        description={(error as Error).message}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  if (journeys.length === 0) {
    return (
      <EmptyState
        icon={PenLine}
        title="Bạn chưa đăng hành trình nào"
        description="Kể lại chuyến đi của bạn theo từng ngày, từng điểm dừng và chi phí thật. Người khác có thể clone về làm lịch trình của họ."
        action={
          <GlassButton asChild size="lg" tone="sunset">
            <Link to="/posts/new">
              <Plus />
              Đăng hành trình đầu tiên
            </Link>
          </GlassButton>
        }
      />
    )
  }

  return (
    <div className="animate-fade-rise grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {journeys.map((journey) => (
        <MyJourneyCard key={journey._id} journey={journey} />
      ))}
    </div>
  )
}

function MyJourneyCard({ journey }: { journey: ServerTripPost }) {
  const draft = journey.status === 'draft'
  const title = journey.title.trim() || 'Hành trình chưa đặt tên'
  const cover = journey.coverUrl || travelCover(journey.title.slice(0, 30) || 'chillngo', themeFromText(journey.title))
  // A draft opens in the editor; a published journey opens its page.
  const href = draft ? `/posts/${journey._id}/edit` : `/posts/${journey._id}`

  return (
    <GlassCard interactive className="overflow-hidden">
      <Link to={href} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden bg-np-well">
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <span
            className={cn(
              'absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
              draft ? 'border border-np-beige/15 bg-np-canopy/75 text-np-cream' : 'bg-primary text-primary-foreground',
            )}
          >
            {draft ? 'Nháp' : 'Đã đăng'}
          </span>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{tripLengthLabel(journey.days.length)}</span>
            <span>{formatVnd(journey.totalEstCost)}</span>
          </div>

          <h3 className="font-display text-xl">{title}</h3>

          {journey.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{journey.summary}</p>}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {draft ? 'Sửa lần cuối' : 'Cập nhật'} {relativeTime(journey.updatedAt)}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-np-cream group-hover:underline">
              {draft ? (
                <>
                  <PenLine className="size-4" aria-hidden />
                  Viết tiếp
                </>
              ) : (
                'Xem bài'
              )}
            </span>
          </div>
        </div>
      </Link>
    </GlassCard>
  )
}

/* ---------------------------------------------------------- đã clone về */

function ClonedItineraries() {
  const { data: itineraries, isPending } = useMyItineraries()

  if (isPending) return <GridSkeleton />

  if (!itineraries || itineraries.length === 0) {
    return (
      <EmptyState
        icon={Map}
        title="Chưa có lịch trình nào"
        description="Khi bạn thấy một hành trình hợp ý, bấm “Dùng làm lịch trình của tôi” để clone nó về đây rồi sửa theo cách bạn muốn đi."
        action={
          <GlassButton asChild size="lg">
            <Link to="/discover">Khám phá hành trình</Link>
          </GlassButton>
        }
      />
    )
  }

  return (
    <div className="animate-fade-rise grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {itineraries.map((itinerary) => (
        <GlassCard key={itinerary._id} interactive className="overflow-hidden">
          <Link to={`/itineraries/${itinerary._id}`} className="group block">
            <div className="aspect-[16/10] overflow-hidden bg-white/5">
              <img
                src={itinerary.coverUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{STATUS_LABELS[itinerary.status]}</Badge>
                <span className="text-xs text-muted-foreground">{tripLengthLabel(itinerary.days.length)}</span>
              </div>

              <h3 className="font-display text-xl">{itinerary.title}</h3>

              <p className="line-clamp-2 text-sm text-muted-foreground">{itinerary.note}</p>

              <dl className="flex items-baseline justify-between pt-1 text-sm">
                <dt className="text-muted-foreground">Khởi hành</dt>
                <dd>{formatShortDate(itinerary.startDate)}</dd>
              </dl>
              <dl className="flex items-baseline justify-between text-sm">
                <dt className="text-muted-foreground">Tổng chi phí</dt>
                <dd>{formatVnd(itinerary.totalEstCost)}</dd>
              </dl>

              <p className="pt-1 text-xs text-muted-foreground">
                Cập nhật {relativeTime(itinerary.updatedAt)}
                {itinerary.sourcePostIds.length > 1 && ` · ghép từ ${itinerary.sourcePostIds.length} bài`}
              </p>
            </div>
          </Link>
        </GlassCard>
      ))}
    </div>
  )
}
