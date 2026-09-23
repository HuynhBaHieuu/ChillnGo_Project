import { Bookmark, Copy, FileText, MapPin } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyItineraries } from '@/features/itinerary-clone/hooks'
import { FollowButton } from '@/features/social/components/FollowButton'
import { useBookmarkedPosts, useUser } from '@/features/social/hooks'
import { usePostsByAuthor } from '@/features/trip-post/hooks'
import { formatCount, formatShortDate, formatVnd, tripLengthLabel } from '@/lib/format'
import type { ProfileTab } from '@/services/types'
import { useAuthStore } from '@/store'

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'posts', label: 'Bài viết' },
  { value: 'saved', label: 'Đã lưu' },
  { value: 'cloned', label: 'Lịch trình đã clone' },
]

export function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewerId = useAuthStore((s) => s.user?._id)

  const { data: user, isPending: isLoadingUser } = useUser(id)
  const { data: posts, isPending: isLoadingPosts } = usePostsByAuthor(id)
  const { data: saved, isPending: isLoadingSaved } = useBookmarkedPosts(id)
  const { data: itineraries, isPending: isLoadingItineraries } = useMyItineraries()

  const isOwnProfile = viewerId === id

  const tabParam = searchParams.get('tab')
  const activeTab: ProfileTab = TABS.some((t) => t.value === tabParam)
    ? (tabParam as ProfileTab)
    : 'posts'

  if (isLoadingUser) return <ProfileSkeleton />

  if (!user) {
    return (
      <PageContainer>
        <EmptyState
          title="Không tìm thấy người dùng"
          action={
            <Button asChild variant="outline">
              <Link to="/discover">Về trang Khám phá</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/*
        Cover, then the name beneath it as a caption row.

        The avatar used to straddle the bottom edge of the banner with the name
        beside it, over the photograph. At the display scale the name is 52px,
        which put it well inside the picture and down to 1.8:1 against a bright
        frame. The system's answer to "photo plus who it belongs to" is the
        caption row it already uses everywhere else, so this is that.
      */}
      <div className="animate-fade-rise">
        <div className="aspect-[3/1] w-full overflow-hidden bg-white/5 sm:aspect-[16/9]">
          <img src={user.coverUrl} alt="" className="size-full object-cover" />
        </div>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-[1rem]">
            <Avatar className="size-14 rounded-2xl">
              <AvatarImage src={user.avatarUrl} alt="" />
              <AvatarFallback className="text-xl">
                {user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div>
              <h1 className="font-display text-4xl tracking-tight">
                {user.displayName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
            </div>
          </div>

          <div className="shrink-0">
            {isOwnProfile ? (
              <Button asChild variant="outline">
                <Link to="/posts/new">Đăng bài mới</Link>
              </Button>
            ) : (
              <FollowButton userId={user._id} />
            )}
          </div>
        </div>
      </div>

      {/* Bio + counts */}
      <div className="animate-fade-rise-delay mt-8 flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {user.location}
          </p>
        </div>

        <dl className="flex gap-8">
          <Stat label="Bài viết" value={formatCount(user.postCount)} />
          <Stat label="Người theo dõi" value={formatCount(user.followerCount)} />
          <Stat label="Đang theo dõi" value={formatCount(user.followingCount)} />
        </dl>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
        className="mt-12"
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="posts">
          {isLoadingPosts && (
            <div className="grid gap-6 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <TripCardSkeleton key={i} layout="grid" />
              ))}
            </div>
          )}
          {posts?.length === 0 && (
            <EmptyState
              icon={FileText}
              title="Chưa có bài viết nào"
              description={
                isOwnProfile
                  ? 'Hành trình đầu tiên của bạn sẽ xuất hiện ở đây.'
                  : 'Người dùng này chưa chia sẻ hành trình nào.'
              }
            />
          )}
          {posts && posts.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <TripCard key={post._id} post={post} layout="grid" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved">
          {isLoadingSaved && (
            <div className="grid gap-6 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <TripCardSkeleton key={i} layout="grid" />
              ))}
            </div>
          )}
          {saved?.length === 0 && (
            <EmptyState
              icon={Bookmark}
              title="Chưa lưu hành trình nào"
              description="Bấm biểu tượng dấu trang trên một bài viết để lưu lại đọc sau."
            />
          )}
          {saved && saved.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2">
              {saved.map((post) => (
                <TripCard key={post._id} post={post} layout="grid" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cloned">
          {!isOwnProfile ? (
            <EmptyState
              icon={Copy}
              title="Lịch trình riêng tư"
              description="Chỉ chủ tài khoản mới xem được những lịch trình đã clone."
            />
          ) : (
            <>
              {isLoadingItineraries && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-40 rounded-2xl" />
                  ))}
                </div>
              )}
              {itineraries?.length === 0 && (
                <EmptyState
                  icon={Copy}
                  title="Chưa clone lịch trình nào"
                  description="Khi bạn clone một hành trình, nó sẽ xuất hiện ở đây."
                />
              )}
              {itineraries && itineraries.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {itineraries.map((itinerary) => (
                    <GlassCard key={itinerary._id} interactive className="p-5">
                      <Link to={`/itineraries/${itinerary._id}`} className="block">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">
                            {tripLengthLabel(itinerary.days.length)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(itinerary.startDate)}
                          </span>
                        </div>
                        <h3 className="mt-3 font-display text-xl">
                          {itinerary.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {itinerary.note}
                        </p>
                        <p className="mt-3 text-sm">{formatVnd(itinerary.totalEstCost)}</p>
                      </Link>
                    </GlassCard>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="font-display text-2xl">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="aspect-[4/1] w-full rounded-2xl" />
      <div className="-mt-14 flex items-end gap-4 px-2">
        <Skeleton className="size-28 rounded-full" />
        <div className="space-y-2 pb-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="mt-8 h-4 w-full max-w-xl" />
      <Skeleton className="mt-12 h-10 w-80 rounded-full" />
    </PageContainer>
  )
}
