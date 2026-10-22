import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { postService, socialService } from '@/services'
import type { TripPostPayload, TripPostWithAuthor } from '@/services/types'
import { useViewerId } from '@/store'

export function useFeed() {
  const viewerId = useViewerId()
  // Who you follow, including follows stored by the API. Same query as the
  // Newsfeed's check-ins and the Live page, so the cache is shared.
  const following = useQuery({
    queryKey: ['following', viewerId],
    queryFn: () => socialService.getFollowingIds(viewerId as string),
    enabled: Boolean(viewerId),
  })
  const followingIds = following.data ?? []
  return useQuery({
    queryKey: [...qk.post.feed(viewerId), followingIds.join(',')],
    queryFn: () => postService.getFeed(viewerId, followingIds),
    // If the API cannot say, still show what this session knows.
    enabled: !viewerId || following.isSuccess || following.isError,
  })
}

export function usePost(postId: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.post.detail(postId ?? '', viewerId),
    queryFn: () => postService.getPostById(postId as string, viewerId),
    enabled: Boolean(postId),
  })
}

export function usePostsByAuthor(authorId: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.post.byAuthor(authorId ?? '', viewerId),
    queryFn: () => postService.getPostsByAuthor(authorId as string, viewerId),
    enabled: Boolean(authorId),
  })
}

/** Journeys you wrote yourself, published and drafts (Hành trình của tôi). */
export function useMyJourneys() {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.post.mine(viewerId),
    queryFn: postService.listMyJourneys,
    enabled: Boolean(viewerId),
  })
}

/** Every published post — the source list for the merge picker. */
export function usePublishedPosts(enabled = true) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.post.published(viewerId),
    queryFn: () => postService.getPublishedPosts(viewerId),
    enabled,
  })
}

export function useComments(postId: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    // Hidden comments depend on who is looking.
    queryKey: [...qk.post.comments(postId ?? ''), viewerId],
    queryFn: () => postService.getComments(postId as string),
    enabled: Boolean(postId),
  })
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (input: { content: string; parentId: string | null }) =>
      postService.addComment({
        postId,
        authorId: viewerId as string,
        parentId: input.parentId,
        content: input.content,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: qk.post.detail(postId, viewerId) })
    },
  })
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (commentId: string) => postService.deleteComment(postId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: qk.post.detail(postId, viewerId) })
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useHideComment(postId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (input: { commentId: string; hidden: boolean }) =>
      postService.hideComment(postId, input.commentId, input.hidden),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: qk.post.detail(postId, viewerId) })
    },
  })
}

/**
 * Like with optimistic UI.
 *
 * The heart and the counter flip on click; a failure rolls the cached post
 * back to the snapshot taken in `onMutate`.
 */
export function useToggleLike(postId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()
  const key = qk.post.detail(postId, viewerId)

  return useMutation({
    mutationFn: () => postService.toggleLike(postId, viewerId as string),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TripPostWithAuthor>(key)

      queryClient.setQueryData<TripPostWithAuthor>(key, (old) =>
        old
          ? {
              ...old,
              likedByMe: !old.likedByMe,
              likeCount: Math.max(0, old.likeCount + (old.likedByMe ? -1 : 1)),
            }
          : old,
      )

      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: qk.post.feed(viewerId) })
    },
  })
}

/** Bookmark with optimistic UI — same shape as `useToggleLike`. */
export function useToggleBookmark(postId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()
  const key = qk.post.detail(postId, viewerId)

  return useMutation({
    mutationFn: () => postService.toggleBookmark(postId, viewerId as string),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TripPostWithAuthor>(key)

      queryClient.setQueryData<TripPostWithAuthor>(key, (old) =>
        old
          ? {
              ...old,
              bookmarkedByMe: !old.bookmarkedByMe,
              bookmarkCount: Math.max(
                0,
                old.bookmarkCount + (old.bookmarkedByMe ? -1 : 1),
              ),
            }
          : old,
      )

      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: qk.post.feed(viewerId) })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
      if (viewerId) {
        void queryClient.invalidateQueries({
          queryKey: qk.social.bookmarks(viewerId, viewerId),
        })
      }
    },
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TripPostPayload) => postService.createPost(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
      // Drafts and published journeys are listed in Your Activity too.
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useUpdatePost(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TripPostPayload) => postService.updatePost(postId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
      // Drafts and published journeys are listed in Your Activity too.
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

/* ------------------------------------------------------------ companions */

/** Your friends, who you can invite along. Only fetched while `enabled` (the invite dialog is open). */
export function useFriends(enabled: boolean) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.social.friends(viewerId),
    queryFn: () => socialService.getFriends(viewerId as string),
    enabled: enabled && Boolean(viewerId),
  })
}

/** Invite, answer an invite, or take someone off: each refreshes every journey list and the journey itself. */
function useCompanionMutation<T>(fn: (input: T) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
    },
  })
}

export function useInviteCompanions(postId: string) {
  return useCompanionMutation((userIds: string[]) => postService.inviteCompanions(postId, userIds))
}

export function useRespondToInvite(postId: string) {
  return useCompanionMutation((accept: boolean) => postService.respondToInvite(postId, accept))
}

export function useRemoveCompanion(postId: string) {
  return useCompanionMutation((userId: string) => postService.removeCompanion(postId, userId))
}
