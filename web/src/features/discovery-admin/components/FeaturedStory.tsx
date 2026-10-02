import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

/**
 * One trip told as a big photo: the title and the author's handle sit on a
 * dark band along the bottom. Height comes from `className`.
 */
export function FeaturedStory({
  post,
  className,
}: {
  post: TripPostWithAuthor
  className?: string
}) {
  return (
    <Link
      to={`/posts/${post._id}`}
      className={cn('np-media group relative block overflow-hidden rounded-xl', className)}
    >
      <img
        src={post.coverUrl}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full rounded-[inherit] object-cover transition-opacity duration-100 ease-linear group-hover:opacity-90"
      />
      <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.6)_70%,rgba(0,0,0,0)_100%)] px-5 pb-5 pt-14 md:px-6 md:pb-6">
        <span className="block font-display text-2xl font-bold leading-tight text-white decoration-2 underline-offset-4 group-hover:underline md:text-3xl">
          {post.title}
        </span>
        <span className="mt-2 flex items-center gap-2 text-sm text-white/90">
          <Avatar className="size-6">
            <AvatarImage src={post.author.avatarUrl} alt="" />
            <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          @{post.author.username}
        </span>
      </span>
    </Link>
  )
}
