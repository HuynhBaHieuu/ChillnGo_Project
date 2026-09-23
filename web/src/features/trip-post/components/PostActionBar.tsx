import { Bookmark, Copy, Heart, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { useToggleBookmark, useToggleLike } from '@/features/trip-post/hooks'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'
import { useAuthStore } from '@/store'

interface PostActionBarProps {
  post: TripPostWithAuthor
  onClone: () => void
  /** Scrolls to the comment box. */
  onComment: () => void
}

export function PostActionBar({ post, onClone, onComment }: PostActionBarProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  const toggleLike = useToggleLike(post._id)
  const toggleBookmark = useToggleBookmark(post._id)

  /** Anything that writes needs a session; send guests to sign in first. */
  function requireAuth(action: () => void) {
    if (!isAuthenticated) {
      void navigate('/login')
      return
    }
    action()
  }

  return (
    <GlassCard className="sticky bottom-24 z-30 p-3 md:bottom-6">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          label={`${formatCount(post.likeCount)} lượt thích`}
          active={post.likedByMe}
          onClick={() => requireAuth(() => toggleLike.mutate())}
        >
          <Heart className={cn('size-4', post.likedByMe && 'fill-current')} />
          {formatCount(post.likeCount)}
        </ActionButton>

        <ActionButton label="Bình luận" onClick={onComment}>
          <MessageCircle className="size-4" />
          {formatCount(post.commentCount)}
        </ActionButton>

        <ActionButton
          label={post.bookmarkedByMe ? 'Bỏ lưu' : 'Lưu bài viết'}
          active={post.bookmarkedByMe}
          onClick={() => requireAuth(() => toggleBookmark.mutate())}
        >
          <Bookmark className={cn('size-4', post.bookmarkedByMe && 'fill-current')} />
          {formatCount(post.bookmarkCount)}
        </ActionButton>

        <GlassButton
          size="lg"
          className="ml-auto w-full sm:w-auto"
          onClick={() => requireAuth(onClone)}
        >
          <Copy />
          Dùng làm lịch trình của tôi
        </GlassButton>
      </div>
    </GlassCard>
  )
}

function ActionButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      {children}
    </button>
  )
}
