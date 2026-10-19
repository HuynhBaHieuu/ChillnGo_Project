import { CalendarRange, Pencil, Wallet } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { MapPreview } from '@/components/MapPreview'
import { TagChip } from '@/components/TagChip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DimensionalSwitchSlider } from '@/components/ui/dimensional-switch-slider'
import { Skeleton } from '@/components/ui/skeleton'
import { AiCloneDialog } from '@/features/ai-clone/AiCloneDialog'
import { CloneDialog } from '@/features/itinerary-clone/components/CloneDialog'
import { CommentSection } from '@/features/trip-post/components/CommentSection'
import { DayItinerary } from '@/features/trip-post/components/DayItinerary'
import { PostActionBar } from '@/features/trip-post/components/PostActionBar'
import { usePost } from '@/features/trip-post/hooks'
import {
  BUDGET_LABELS,
  REGION_LABELS,
  SEASON_LABELS,
  formatDateRange,
  formatVnd,
  relativeTime,
  tripLengthLabel,
} from '@/lib/format'
import { useAuthStore } from '@/store'

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: post, isPending, isError, error } = usePost(id)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [aiCloneOpen, setAiCloneOpen] = useState(false)
  const commentsRef = useRef<HTMLDivElement>(null)
  const viewerId = useAuthStore((s) => s.user?._id)

  if (isPending) return <PostDetailSkeleton />

  if (isError || !post) {
    return (
      <PageContainer>
        <EmptyState
          title="Không tìm thấy hành trình"
          description={(error as Error | null)?.message ?? 'Bài viết có thể đã bị xoá.'}
          action={
            <Button asChild variant="outline">
              <Link to="/discover">Quay lại Khám phá</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const isAuthor = viewerId === post.authorId

  return (
    <PageContainer>
      <article>
        {/* Header */}
        <header className="animate-fade-rise">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{REGION_LABELS[post.region]}</span>
            <span aria-hidden>·</span>
            <span>{SEASON_LABELS[post.season]}</span>
            <span aria-hidden>·</span>
            <span>{tripLengthLabel(post.days.length)}</span>
          </div>

          <h1 className="mt-5 max-w-[22ch] font-display text-4xl tracking-tight">
            {post.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {post.summary}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link
              to={`/users/${post.author._id}`}
              className="group flex items-center gap-3"
            >
              <Avatar className="size-11">
                <AvatarImage src={post.author.avatarUrl} alt="" />
                <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>
                <span className="block text-sm group-hover:underline">
                  {post.author.displayName}
                </span>
                <time
                  dateTime={post.createdAt}
                  className="block text-xs text-muted-foreground"
                >
                  Đăng {relativeTime(post.createdAt)}
                </time>
              </span>
            </Link>

            {isAuthor && (
              <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link to={`/posts/${post._id}/edit`}>
                  <Pencil />
                  Chỉnh sửa
                </Link>
              </Button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        </header>

        {/* Cover, and the author's other photos */}
        <PostGallery coverUrl={post.coverUrl} images={post.coverImages ?? []} />

        {/* Key facts */}
        <dl className="animate-fade-rise-delay mt-8 grid gap-4 sm:grid-cols-3">
          <Fact
            icon={<CalendarRange className="size-4" />}
            label="Thời gian"
            value={formatDateRange(post.startDate, post.endDate)}
          />
          <Fact
            icon={<Wallet className="size-4" />}
            label="Tổng chi phí ước tính"
            value={formatVnd(post.totalEstCost)}
          />
          <Fact
            icon={<Wallet className="size-4" />}
            label="Mức chi tiêu"
            value={BUDGET_LABELS[post.budgetLevel]}
          />
        </dl>

        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* Itinerary */}
          <div className="min-w-0 space-y-6">
            <h2 className="font-display text-3xl">Lịch trình từng ngày</h2>
            {post.days.map((day) => (
              <DayItinerary key={day._id} day={day} />
            ))}
          </div>

          {/* Map */}
          <aside className="min-w-0 lg:sticky lg:top-32">
            <h2 className="font-display text-3xl">Bản đồ tuyến</h2>
            <MapPreview
              days={post.days}
              className="mt-6 h-[28rem] w-full"
              label={`Bản đồ tuyến đường của ${post.title}`}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Mỗi màu là một ngày, số là thứ tự điểm dừng trong ngày. Chọn một ngày hoặc
              một điểm để xem đường đi của ngày đó: đường bộ theo đường thật, nét đứt là
              máy bay hoặc tàu, phà. Chạm vào một chặng để xem phương tiện và thời gian.
            </p>
          </aside>
        </div>

        <div className="mt-12">
          <PostActionBar
            post={post}
            onClone={() => setCloneOpen(true)}
            onAiClone={() => setAiCloneOpen(true)}
            onComment={() =>
              commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        </div>

        <div ref={commentsRef} className="mt-16">
          <CommentSection postId={post._id} postAuthorId={post.authorId} commentCount={post.commentCount} />
        </div>
      </article>

      <CloneDialog post={post} open={cloneOpen} onOpenChange={setCloneOpen} />
      <AiCloneDialog post={post} open={aiCloneOpen} onOpenChange={setAiCloneOpen} />
    </PageContainer>
  )
}

function PostGallery({ coverUrl, images }: { coverUrl: string; images: string[] }) {
  const photos = images.length ? images : [coverUrl]
  return (
    <DimensionalSwitchSlider
      // A new set of photos starts again from the first.
      key={photos.join('|')}
      items={photos.map((image) => ({ image }))}
      label="Ảnh của hành trình"
      className="animate-fade-rise-delay mt-10"
      stageClassName="aspect-[16/10] w-full rounded-2xl sm:aspect-[21/9]"
    />
  )
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 text-base">{value}</dd>
    </div>
  )
}

function PostDetailSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-3.5 w-48" />
      <Skeleton className="mt-4 h-12 w-full max-w-3xl" />
      <Skeleton className="mt-3 h-12 w-full max-w-xl" />
      <Skeleton className="mt-6 h-4 w-full max-w-2xl" />
      <div className="mt-7 flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="mt-10 aspect-[21/9] w-full rounded-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </PageContainer>
  )
}
