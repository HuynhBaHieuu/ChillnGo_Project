import { Bookmark, Heart, MessageCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToggleBookmark } from '@/features/trip-post/hooks'
import { BUDGET_LABELS, formatCount, formatVndShort, tripLengthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'
import { useAuthStore } from '@/store'

interface DiscoverCardProps {
  post: TripPostWithAuthor
  /** Small label above the title, e.g. the region. */
  chip?: string
  /**
   * `square` is the default listing card; `wide` is the inspiration card — a
   * landscape photo with the title centred underneath and nothing else.
   */
  variant?: 'square' | 'wide'
  className?: string
}

/** A photo-first trip card: cover with a save button, then title and numbers. */
export function DiscoverCard({ post, chip, variant = 'square', className }: DiscoverCardProps) {
  const isWide = variant === 'wide'
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const toggleBookmark = useToggleBookmark(post._id)

  function save() {
    if (!isAuthenticated) {
      void navigate('/login')
      return
    }
    toggleBookmark.mutate()
  }

  return (
    <article className={cn('group relative', className)}>
      <Link to={`/posts/${post._id}`} className="block rounded-xl">
        <div
          className={cn(
            'np-media relative overflow-hidden rounded-xl',
            isWide ? 'aspect-[16/10]' : 'aspect-square',
          )}
        >
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full rounded-[inherit] object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {!isWide && (
            <Badge className="absolute bottom-3 left-3 bg-forest-ink/70 backdrop-blur-sm">
              {tripLengthLabel(post.days.length)}
            </Badge>
          )}
        </div>

        {isWide ? (
          <h3 className="mx-auto mt-5 max-w-sm text-center font-display text-lg leading-snug group-hover:underline">
            {post.title}
          </h3>
        ) : (
          <div className="pt-3">
            {chip && (
              <span className="mb-2 inline-block rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                {chip}
              </span>
            )}
            <h3 className="line-clamp-2 font-display text-lg leading-snug group-hover:underline">
              {post.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Heart className={cn('size-3.5', post.likedByMe && 'fill-current text-foreground')} />
                {formatCount(post.likeCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {formatCount(post.commentCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark className="size-3.5" />
                {formatCount(post.bookmarkCount)}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium">
              {BUDGET_LABELS[post.budgetLevel]} · từ {formatVndShort(post.totalEstCost)}
            </p>
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={save}
        aria-pressed={post.bookmarkedByMe}
        aria-label={post.bookmarkedByMe ? 'Bỏ lưu hành trình' : 'Lưu hành trình'}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background"
      >
        <Bookmark className={cn('size-4', post.bookmarkedByMe && 'fill-current')} />
      </button>
    </article>
  )
}

/** Same footprint as a square `DiscoverCard`, for rows that are still loading. */
export function DiscoverCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-3 h-5 w-4/5" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </div>
  )
}
