import { Heart, MessageCircle, MessageSquareQuote, Radio, Repeat2, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ActivityTabs, Empty, ErrorPanel, ListSkeleton, NotAvailable, Row, SectionHeader, Thumb } from '@/features/activity/components'
import { journeyStats, timeAgo } from '@/features/activity/format'
import { useJourneyComments, useLikedJourneys, useLiveComments, useUnlike } from '@/features/activity/hooks'

export function InteractionsSection() {
  return (
    <>
      <SectionHeader
        title="Lượt tương tác"
        description="Xem lại những hành trình bạn đã thích và các bình luận bạn đã để lại trên ChillnGo."
      />
      <ActivityTabs
        label="Loại tương tác"
        tabs={[
          { value: 'likes', label: 'Lượt thích', content: <Likes /> },
          { value: 'comments', label: 'Bình luận', content: <Comments /> },
          {
            value: 'reposts',
            label: 'Chia sẻ lại',
            content: (
              <NotAvailable
                icon={Repeat2}
                feature="tính năng chia sẻ lại"
                description="Khi có tính năng này, những hành trình bạn chia sẻ lại cho người theo dõi sẽ hiện ở đây."
              />
            ),
          },
          {
            value: 'story-replies',
            label: 'Phản hồi tin',
            content: (
              <NotAvailable
                icon={MessageSquareQuote}
                feature="tính năng tin (story)"
                description="Khi có tính năng tin, các phản hồi và cảm xúc bạn gửi cho tin của người khác sẽ hiện ở đây."
              />
            ),
          },
          {
            value: 'reviews',
            label: 'Đánh giá',
            content: (
              <NotAvailable
                icon={Star}
                feature="tính năng đánh giá"
                description="Khi có tính năng đánh giá, những đánh giá bạn viết cho địa điểm và hành trình sẽ được gom lại ở đây."
              />
            ),
          },
        ]}
      />
    </>
  )
}

function Likes() {
  const liked = useLikedJourneys()
  const unlike = useUnlike()

  if (liked.isPending) return <ListSkeleton />
  if (liked.isError) return <ErrorPanel error={liked.error} onRetry={() => void liked.refetch()} />
  if (liked.data.length === 0) {
    return (
      <Empty
        icon={Heart}
        title="Chưa có lượt thích nào"
        description="Bấm vào trái tim ở hành trình bạn thích, hành trình đó sẽ hiện ở đây."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/discover">Khám phá hành trình</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="space-y-1">
      {liked.data.map((post) => (
        <Row key={post._id}>
          <Link to={`/posts/${post._id}`} className="flex min-w-0 flex-1 items-center gap-4">
            <Thumb src={post.coverUrl} className="size-16 sm:h-16 sm:w-24" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-snug text-np-cream group-hover:underline">{post.title}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                của {post.author.displayName} · {journeyStats(post)}
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full text-np-social hover:text-np-social"
            disabled={unlike.isPending && unlike.variables === post._id}
            onClick={() => unlike.mutate(post._id)}
            aria-label={`Bỏ thích ${post.title}`}
          >
            <Heart className="fill-current" aria-hidden />
            <span className="hidden sm:inline">Bỏ thích</span>
          </Button>
        </Row>
      ))}
    </ul>
  )
}

/** Journey comments (still mock data) and livestream comments (from the API), newest first. */
function Comments() {
  const journey = useJourneyComments()
  const live = useLiveComments()

  if (journey.isPending || live.isPending) return <ListSkeleton />
  if (live.isError) return <ErrorPanel error={live.error} onRetry={() => void live.refetch()} />
  if (journey.isError) return <ErrorPanel error={journey.error} onRetry={() => void journey.refetch()} />

  const items = [
    ...journey.data.map((c) => ({
      key: `j-${c._id}`,
      text: c.content,
      at: c.createdAt,
      href: c.post ? `/posts/${c.post._id}` : null,
      where: c.post?.title ?? 'một hành trình đã bị xoá',
      thumb: c.post?.coverUrl ?? null,
      live: false,
    })),
    ...live.data.map((c) => ({
      key: `l-${c._id}`,
      text: c.text,
      at: c.createdAt,
      href: c.livestream ? `/live/${c.livestream._id}` : null,
      where: c.livestream
        ? `${c.livestream.title}${c.livestream.host ? ` · live của ${c.livestream.host.displayName}` : ''}`
        : 'một buổi live không còn tồn tại',
      thumb: c.livestream?.host?.avatarUrl ?? null,
      live: true,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  if (items.length === 0) {
    return (
      <Empty
        icon={MessageCircle}
        title="Chưa có bình luận nào"
        description="Bình luận bạn viết trên hành trình và trong các buổi livestream sẽ được liệt kê ở đây."
      />
    )
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const body = (
          <>
            <Thumb src={item.thumb} className="size-12 rounded-full">
              {item.live && (
                <span className="absolute inset-x-0 bottom-0 bg-np-social py-px text-center text-[8px] font-bold uppercase tracking-wider text-np-ink">
                  Live
                </span>
              )}
            </Thumb>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[15px] leading-snug text-np-cream">“{item.text}”</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                {item.live && <Radio className="size-3.5 shrink-0 text-np-social" aria-hidden />}
                <span className="truncate">
                  Tại {item.where} · {timeAgo(item.at)}
                </span>
              </p>
            </div>
          </>
        )
        return (
          <Row key={item.key}>
            {item.href ? (
              <Link to={item.href} className="flex min-w-0 flex-1 items-center gap-4">
                {body}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-4">{body}</div>
            )}
          </Row>
        )
      })}
    </ul>
  )
}
