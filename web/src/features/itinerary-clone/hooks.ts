import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { itineraryService } from '@/services'
import { useViewerId } from '@/store'

export function useMyItineraries() {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.itinerary.mine(viewerId ?? ''),
    queryFn: () => itineraryService.getMyItineraries(viewerId as string),
    enabled: Boolean(viewerId),
  })
}

/** One of your itineraries; someone else's is "not found". */
export function useItinerary(id: string | undefined) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: qk.itinerary.detail(id ?? '', viewerId),
    queryFn: () => itineraryService.getItineraryById(id as string, viewerId as string),
    enabled: Boolean(id && viewerId),
  })
}

/** The clone flow: copies a post's days into a new itinerary you own. */
export function useClonePost() {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (input: { postId: string; title?: string; startDate?: string }) =>
      itineraryService.clonePost({ ...input, ownerId: viewerId as string }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.itinerary.all })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
    },
  })
}

export function useReorderDays(itineraryId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (orderedDayIds: string[]) =>
      itineraryService.reorderItineraryDays(itineraryId, orderedDayIds, viewerId as string),
    onSuccess: (updated) => {
      // Write the server's answer straight into the cache — the list was
      // already reordered locally, so this only reconciles dates and totals.
      queryClient.setQueryData(qk.itinerary.detail(itineraryId, viewerId), updated)
      void queryClient.invalidateQueries({ queryKey: qk.itinerary.all })
    },
  })
}

export function useMergeIntoItinerary(itineraryId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (selections: { postId: string; dayIds: string[] }[]) =>
      itineraryService.mergeIntoItinerary({ itineraryId, ownerId: viewerId as string, selections }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.itinerary.detail(itineraryId, viewerId), updated)
      void queryClient.invalidateQueries({ queryKey: qk.itinerary.all })
    },
  })
}

export function useRemoveDay(itineraryId: string) {
  const queryClient = useQueryClient()
  const viewerId = useViewerId()

  return useMutation({
    mutationFn: (dayId: string) =>
      itineraryService.removeItineraryDay(itineraryId, dayId, viewerId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.itinerary.detail(itineraryId, viewerId), updated)
      void queryClient.invalidateQueries({ queryKey: qk.itinerary.all })
    },
  })
}
