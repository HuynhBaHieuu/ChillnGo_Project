import { useQuery } from '@tanstack/react-query'
import { Compass, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { CheckInCard } from '@/features/checkin/CheckInCard'
import { PostComposer } from '@/features/trip-post/components/PostComposer'
import { useFeed } from '@/features/trip-post/hooks'
import { checkinService, socialService } from '@/services'
import type { CheckIn } from '@/services/checkin.service'
import type { TripPostWithAuthor } from '@/services/types'
import { useAuthStore, useViewerId } from '@/store'

type FeedItem =
  | { kind: 'post'; at: string; post: TripPostWithAuthor }
  | { kind: 'checkin'; at: string; checkin: CheckIn }

/**
 * Trip posts (still mock data) and photo check-ins (from the API), newest
 * first. Signed in: yours and the people you follow. Signed out: everyone's.
 */
export function FeedPage() {
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

  const items = useMemo<FeedItem[]>(() => {
    const all: FeedItem[] = [
      ...(posts ?? []).map((post) => ({ kind: 'post' as const, at: post.createdAt, post })),
      // A check-in feed that fails to load (API down) should not hide the posts.
      ...(checkins.data ?? []).map((checkin) => ({ kind: 'checkin' as const, at: checkin.createdAt, checkin })),
    ]
    return all.sort((a, b) => b.at.localeCompare(a.at))
  }, [posts, checkins.data])

  return (
    <PageContainer>
      <PageHeader
        title="Newsfeed"
        description={
          isAuthenticated
            ? 'Hành trình và check-in mới nhất từ bạn và những người bạn đang theo dõi.'
            : 'Những hành trình và check-in mới nhất trên ChillnGo. Đăng nhập để chỉ xem người bạn theo dõi.'
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

      {isAuthenticated && user && (
        <div className="animate-fade-rise mb-8">
          <PostComposer user={user} />
        </div>
      )}

      {isPending && (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && <EmptyState title="Không tải được newsfeed" description={(error as Error).message} />}

      {posts && items.length === 0 && (
        <EmptyState
          icon={Users}
          title="Newsfeed đang trống"
          description="Bạn chưa theo dõi ai, hoặc những người bạn theo dõi chưa đăng gì. Hãy check-in chuyến đi của bạn, hoặc tìm vài người đi cùng gu ở trang Khám phá."
          action={
            <GlassButton asChild size="lg">
              <Link to="/discover">Khám phá hành trình</Link>
            </GlassButton>
          }
        />
      )}

      {posts && items.length > 0 && (
        <div className="animate-fade-rise-delay flex flex-col gap-6">
          {items.map((item) =>
            item.kind === 'post' ? (
              <TripCard key={`post-${item.post._id}`} post={item.post} />
            ) : (
              <CheckInCard key={`checkin-${item.checkin._id}`} checkin={item.checkin} viewerId={viewerId} />
            ),
          )}
        </div>
      )}
    </PageContainer>
  )
}
