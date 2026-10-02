import { Bookmark, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

/**
 * The award band: the pitch on the left, the community's most-saved trip on
 * the right with its title and author pinned over the photo.
 */
export function TripOfTheYearBanner({
  post,
  className,
}: {
  post: TripPostWithAuthor
  className?: string
}) {
  return (
    <GlassCard className={cn('np-featured overflow-hidden', className)}>
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col items-start justify-center p-8 sm:p-12 lg:p-16">
          <span className="grid size-16 place-items-center rounded-2xl bg-sunset text-sunset-foreground">
            <Trophy className="size-8" />
          </span>
          <h2 className="mt-6 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Hành trình của năm
          </h2>
          <p className="mt-5 max-w-md text-base font-medium leading-relaxed">
            Được lưu nhiều nhất trên ChillnGo — do chính cộng đồng bình chọn bằng từng lượt lưu.
          </p>
          <GlassButton asChild tone="sunset" size="lg" className="mt-8">
            <Link to={`/posts/${post._id}`}>Xem hành trình</Link>
          </GlassButton>
        </div>

        <Link
          to={`/posts/${post._id}`}
          className="group relative block aspect-square overflow-hidden lg:aspect-auto lg:min-h-[32rem]"
        >
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute left-1/2 top-0 max-w-[85%] -translate-x-1/2 truncate rounded-b-xl bg-sunset px-5 py-2 font-display text-base text-sunset-foreground">
            {post.title}
          </span>
          <span className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-background/85 px-4 py-1.5 text-sm backdrop-blur-sm">
            {post.author.displayName}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Bookmark className="size-3.5" />
              {formatCount(post.bookmarkCount)}
            </span>
          </span>
        </Link>
      </div>
    </GlassCard>
  )
}
