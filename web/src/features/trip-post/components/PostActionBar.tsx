import { Bookmark, Copy, Heart, MessageCircle, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { useToggleBookmark, useToggleLike } from '@/features/trip-post/hooks'
import { t } from '@/i18n'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { aiCloneService } from '@/services'
import type { TripPostWithAuthor } from '@/services/types'
import { useAuthStore } from '@/store'

interface PostActionBarProps {
  post: TripPostWithAuthor
  onClone: () => void
  /** Opens the AI clone form; offered only on journeys the AI can adapt. */
  onAiClone: () => void
  /** Scrolls to the comment box. */
  onComment: () => void
}

export function PostActionBar({ post, onClone, onAiClone, onComment }: PostActionBarProps) {
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
          label={t('{n} lượt thích', { n: formatCount(post.likeCount) })}
          active={post.likedByMe}
          onClick={() => requireAuth(() => toggleLike.mutate())}
        >
          <Heart className={cn('size-4', post.likedByMe && 'fill-current')} />
          {formatCount(post.likeCount)}
        </ActionButton>

        <ActionButton label={t('Bình luận')} onClick={onComment}>
          <MessageCircle className="size-4" />
          {formatCount(post.commentCount)}
        </ActionButton>

        <ActionButton
          label={post.bookmarkedByMe ? t('Bỏ lưu') : t('Lưu bài viết')}
          active={post.bookmarkedByMe}
          onClick={() => requireAuth(() => toggleBookmark.mutate())}
        >
          <Bookmark className={cn('size-4', post.bookmarkedByMe && 'fill-current')} />
          {formatCount(post.bookmarkCount)}
        </ActionButton>

        <span
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground"
          title={t('Số lần hành trình này được clone')}
        >
          <Copy className="size-4" />
          {t('{n} lượt clone', { n: formatCount(post.cloneCount) })}
        </span>

        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          {aiCloneService.canAiClone(post._id) && (
            <GlassButton size="lg" tone="sunset" className="flex-1 sm:flex-none" onClick={() => requireAuth(onAiClone)}>
              <Sparkles />
              {t('Clone với AI')}
            </GlassButton>
          )}
          <GlassButton size="lg" className="flex-1 sm:flex-none" onClick={() => requireAuth(onClone)}>
            <Copy />
            {t('Dùng làm lịch trình của tôi')}
          </GlassButton>
        </div>
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
