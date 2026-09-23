import { Compass, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { useFeed } from '@/features/trip-post/hooks'
import { useAuthStore } from '@/store'

export function FeedPage() {
  const { data: posts, isPending, isError, error } = useFeed()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <PageContainer>
      <PageHeader
        title="Newsfeed"
        description={
          isAuthenticated
            ? 'Hành trình mới nhất từ những người bạn đang theo dõi.'
            : 'Những hành trình mới nhất trên ChillnGo. Đăng nhập để chỉ xem người bạn theo dõi.'
        }
        action={
          <GlassButton asChild size="md" tone="sunset">
            <Link to="/discover">
              <Compass />
              Khám phá thêm
            </Link>
          </GlassButton>
        }
      />

      {isPending && (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="Không tải được newsfeed"
          description={(error as Error).message}
        />
      )}

      {posts && posts.length === 0 && (
        <EmptyState
          icon={Users}
          title="Newsfeed đang trống"
          description="Bạn chưa theo dõi ai, hoặc những người bạn theo dõi chưa đăng hành trình nào. Thử tìm vài người đi cùng gu ở trang Khám phá."
          action={
            <GlassButton asChild size="lg">
              <Link to="/discover">Khám phá hành trình</Link>
            </GlassButton>
          }
        />
      )}

      {posts && posts.length > 0 && (
        <div className="animate-fade-rise-delay flex flex-col gap-6">
          {posts.map((post) => (
            <TripCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
