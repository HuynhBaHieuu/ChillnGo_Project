import { Check, Loader2, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { useIsFollowing, useToggleFollow } from '@/features/social/hooks'
import { useAuthStore } from '@/store'
import { t } from '@/i18n'

interface FollowButtonProps {
  userId: string
}

/**
 * Follow / unfollow.
 *
 * The optimistic update lives in `useToggleFollow`, so this button flips the
 * instant it is pressed and never shows a spinner for the happy path.
 */
export function FollowButton({ userId }: FollowButtonProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  const { data: following, isPending: isLoading } = useIsFollowing(userId)
  const toggle = useToggleFollow(userId)

  function handleClick() {
    if (!isAuthenticated) {
      void navigate('/login')
      return
    }
    toggle.mutate()
  }

  return (
    <GlassButton size="lg" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : following ? (
        <Check />
      ) : (
        <UserPlus />
      )}
      {following ? t('Đang theo dõi') : t('Theo dõi')}
    </GlassButton>
  )
}
