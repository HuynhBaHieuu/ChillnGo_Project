import { Bookmark, Heart, MapPin, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { TagChipList } from '@/components/TagChip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BUDGET_LABELS,
  formatCount,
  formatVndShort,
  relativeTime,
  tripLengthLabel,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

interface TripCardProps {
  post: TripPostWithAuthor
  /** `feed` is a wide horizontal card; `grid` is a compact column card. */
  layout?: 'feed' | 'grid'
  className?: string
}

export function TripCard({ post, layout = 'feed', className }: TripCardProps) {
  const isGrid = layout === 'grid'

  return (
    <GlassCard
      as="article"
      interactive
      className={cn('overflow-hidden', className)}
    >
      <Link
        to={`/posts/${post._id}`}
        className={cn('group block', isGrid ? '' : 'sm:flex')}
      >
        {/* Cover */}
        <div
          className={cn(
            'relative shrink-0 overflow-hidden bg-white/5',
            isGrid ? 'aspect-[4/3] w-full' : 'aspect-[16/10] w-full sm:aspect-auto sm:w-64 md:w-80',
          )}
        >
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          {/* Trip length is metadata, not a call to action, so it stays off the
              accent — a grid of cards would otherwise put a dozen sunset chips
              on screen and spend the palette's 10% on nothing. */}
          <Badge className="absolute left-3 top-3 bg-forest-ink/70 backdrop-blur-sm">
            {tripLengthLabel(post.days.length)}
          </Badge>
        </div>

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-7">
              <AvatarImage src={post.author.avatarUrl} alt="" />
              <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{post.author.displayName}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <time
              dateTime={post.createdAt}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {relativeTime(post.createdAt)}
            </time>
          </div>

          <h3
            className={cn(
              'font-display leading-tight tracking-tight',
              isGrid ? 'text-xl' : 'text-2xl',
            )}
          >
            {post.title}
          </h3>

          {!isGrid && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {post.summary}
            </p>
          )}

          <TagChipList tags={post.tags} max={isGrid ? 2 : 4} />

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <MapPin className="size-3.5" />
              {BUDGET_LABELS[post.budgetLevel]} · {formatVndShort(post.totalEstCost)}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Heart
                className={cn('size-3.5', post.likedByMe && 'fill-current text-foreground')}
              />
              {formatCount(post.likeCount)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-3.5" />
              {formatCount(post.commentCount)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bookmark
                className={cn(
                  'size-3.5',
                  post.bookmarkedByMe && 'fill-current text-foreground',
                )}
              />
              {formatCount(post.bookmarkCount)}
            </span>
          </div>
        </div>
      </Link>
    </GlassCard>
  )
}

/** Matches `TripCard`'s geometry so the feed doesn't jump when data lands. */
export function TripCardSkeleton({ layout = 'feed' }: { layout?: 'feed' | 'grid' }) {
  const isGrid = layout === 'grid'

  return (
    <GlassCard className="overflow-hidden">
      <div className={cn(isGrid ? '' : 'sm:flex')}>
        <Skeleton
          className={cn(
            'rounded-none',
            isGrid ? 'aspect-[4/3] w-full' : 'aspect-[16/10] w-full sm:aspect-auto sm:w-64 md:w-80',
          )}
        />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-6 w-4/5" />
          {!isGrid && <Skeleton className="h-4 w-full" />}
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-auto h-3.5 w-48" />
        </div>
      </div>
    </GlassCard>
  )
}
