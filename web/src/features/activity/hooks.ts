import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { activityService, checkinService, livestreamService, postService, socialService } from '@/services'
import { useViewerId } from '@/store'

/**
 * Data for Your Activity. Everything is the signed-in user's own; the page is
 * behind RequireAuth, so `viewerId` is always set when these run.
 */

function useMe(): string {
  return useViewerId() ?? ''
}

/* ------------------------------------------------------------ interactions */

export function useLikedJourneys() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.likes(me), queryFn: () => activityService.listLikedJourneys(me) })
}

export function useJourneyComments() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.journeyComments(me), queryFn: () => activityService.listJourneyComments(me) })
}

export function useLiveComments() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.liveComments(me), queryFn: activityService.listLiveComments })
}

export function useUnlike() {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => postService.toggleLike(postId, me),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.activity.likes(me) })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
    },
  })
}

/* ------------------------------------------------------- photos and videos */

export function useMyCheckIns() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.checkins(me), queryFn: () => checkinService.listCheckIns([me]) })
}

export function useMyPublishedJourneys() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.published(me), queryFn: postService.listMyPublishedJourneys })
}

/** Your streams: the one live now (if any) and past ones, newest first, a page at a time. */
export function useMyStreams() {
  const me = useMe()
  const live = useQuery({ queryKey: qk.activity.liveNow(me), queryFn: () => livestreamService.listLive([me]) })
  const past = useInfiniteQuery({
    queryKey: qk.activity.streams(me),
    queryFn: ({ pageParam }) => livestreamService.listHistory(me, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextBefore ?? undefined,
  })
  return { live, past }
}

export function useDeleteCheckIn() {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: checkinService.deleteCheckIn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.activity.checkins(me) })
      void queryClient.invalidateQueries({ queryKey: qk.activity.deleted(me) })
      void queryClient.invalidateQueries({ queryKey: ['checkins'] })
    },
  })
}

/* --------------------------------------------------------------- journeys */

export function useDraftJourneys() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.drafts(me), queryFn: postService.listDraftJourneys })
}

/** Publish, duplicate or delete a journey, then refresh every list it can appear in. */
export function useJourneyAction<T>(action: (id: string) => Promise<T>) {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.activity.all(me) })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
    },
  })
}

/* --------------------------------------------------------- search history */

export function useSearchHistory() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.searches(me), queryFn: activityService.listSearchHistory })
}

export function useRemoveSearch() {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityService.removeSearch,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.activity.searches(me) }),
  })
}

export function useClearSearchHistory() {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activityService.clearSearchHistory,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.activity.searches(me) }),
  })
}

/* -------------------------------------------------------- account history */

export function useAccountHistory() {
  const me = useMe()
  return useQuery({ queryKey: qk.activity.account(me), queryFn: activityService.listAccountHistory })
}

/* -------------------------------------------------------- recently deleted */

export function useDeletedItems() {
  const me = useMe()
  const journeys = useQuery({ queryKey: [...qk.activity.deleted(me), 'journeys'], queryFn: postService.listDeletedJourneys })
  const checkins = useQuery({ queryKey: [...qk.activity.deleted(me), 'checkins'], queryFn: checkinService.listDeletedCheckIns })
  return { journeys, checkins }
}

/** Restore or permanently delete something in Recently Deleted. */
export function useDeletedAction<T>(action: (id: string) => Promise<T>) {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    // Also after an error: a restore past its window (410) deletes the item for good.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.activity.all(me) })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
      void queryClient.invalidateQueries({ queryKey: ['checkins'] })
    },
  })
}

/* ------------------------------------------------------------------ saved */

export function useSavedJourneys() {
  const me = useMe()
  return useQuery({ queryKey: qk.social.bookmarks(me, me), queryFn: () => socialService.getBookmarkedPosts(me, me) })
}

export function useUnsave() {
  const me = useMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => postService.toggleBookmark(postId, me),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.social.bookmarks(me, me) })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
      void queryClient.invalidateQueries({ queryKey: qk.discover.all })
    },
  })
}
