import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { socialService } from '@/services'
import { useAuthStore, useViewerId } from '@/store'

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: qk.social.user(userId ?? ''),
    queryFn: () => socialService.getUserById(userId as string),
    enabled: Boolean(userId),
  })
}

export function useIsFollowing(userId: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.social.isFollowing(userId ?? '', viewerId),
    queryFn: () => socialService.isFollowing(userId as string, viewerId),
    enabled: Boolean(userId),
  })
}

export function useBookmarkedPosts(userId: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.social.bookmarks(userId ?? '', viewerId),
    queryFn: () => socialService.getBookmarkedPosts(userId as string, viewerId),
    enabled: Boolean(userId),
  })
}

export function useNotifications() {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.social.notifications(viewerId ?? ''),
    queryFn: () => socialService.getNotifications(viewerId as string),
    enabled: Boolean(viewerId),
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: () => socialService.markAllNotificationsRead(viewerId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.social.notifications(viewerId ?? ''),
      })
    },
  })
}

/**
 * Follow / unfollow with optimistic UI.
 *
 * Both the "am I following" flag and the target's follower count flip
 * immediately; if the (mock) request fails, the snapshot is rolled back and the
 * queries refetch.
 */
export function useToggleFollow(userId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()
  const patchUser = useAuthStore((s) => s.patchUser)
  const viewer = useAuthStore((s) => s.user)

  const followingKey = qk.social.isFollowing(userId, viewerId)
  const userKey = qk.social.user(userId)

  return useMutation({
    mutationFn: () => socialService.toggleFollow(userId, viewerId as string),

    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: followingKey }),
        queryClient.cancelQueries({ queryKey: userKey }),
      ])

      const previousFollowing = queryClient.getQueryData<boolean>(followingKey)
      const previousUser = queryClient.getQueryData<{ followerCount: number }>(userKey)

      const nextFollowing = !previousFollowing
      queryClient.setQueryData(followingKey, nextFollowing)
      queryClient.setQueryData(userKey, (old: typeof previousUser) =>
        old
          ? {
              ...old,
              followerCount: Math.max(0, old.followerCount + (nextFollowing ? 1 : -1)),
            }
          : old,
      )

      if (viewer) {
        patchUser({
          followingCount: Math.max(0, viewer.followingCount + (nextFollowing ? 1 : -1)),
        })
      }

      return { previousFollowing, previousUser, previousViewerFollowing: viewer?.followingCount }
    },

    onError: (_error, _vars, context) => {
      if (context?.previousFollowing !== undefined) {
        queryClient.setQueryData(followingKey, context.previousFollowing)
      }
      if (context?.previousUser) {
        queryClient.setQueryData(userKey, context.previousUser)
      }
      if (context?.previousViewerFollowing !== undefined) {
        patchUser({ followingCount: context.previousViewerFollowing })
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: followingKey })
      void queryClient.invalidateQueries({ queryKey: userKey })
    },
  })
}
