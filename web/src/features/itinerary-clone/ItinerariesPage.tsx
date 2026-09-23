import { Compass, Map } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyItineraries } from '@/features/itinerary-clone/hooks'
import { formatShortDate, formatVnd, relativeTime, tripLengthLabel } from '@/lib/format'
import type { ItineraryStatus } from '@/services/types'

const STATUS_LABELS: Record<ItineraryStatus, string> = {
  planning: 'Đang lên kế hoạch',
  confirmed: 'Đã chốt',
  completed: 'Đã đi',
}

export function ItinerariesPage() {
  const { data: itineraries, isPending } = useMyItineraries()

  return (
    <PageContainer>
      <PageHeader
        title="Hành trình của tôi"
        description="Những lịch trình bạn đã clone về. Sửa thứ tự ngày, ghép thêm ngày từ bài viết khác, và theo dõi tổng chi phí thay đổi theo thời gian thực."
        action={
          <GlassButton asChild size="lg">
            <Link to="/discover">
              <Compass />
              Tìm hành trình mới
            </Link>
          </GlassButton>
        }
      />

      {isPending && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      )}

      {itineraries && itineraries.length === 0 && (
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
      )}

      {itineraries && itineraries.length > 0 && (
        <div className="animate-fade-rise-delay grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                    <span className="text-xs text-muted-foreground">
                      {tripLengthLabel(itinerary.days.length)}
                    </span>
                  </div>

                  <h3 className="font-display text-xl">
                    {itinerary.title}
                  </h3>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {itinerary.note}
                  </p>

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
                    {itinerary.sourcePostIds.length > 1 &&
                      ` · ghép từ ${itinerary.sourcePostIds.length} bài`}
                  </p>
                </div>
              </Link>
            </GlassCard>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
