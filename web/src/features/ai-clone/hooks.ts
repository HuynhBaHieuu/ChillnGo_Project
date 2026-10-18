import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { aiCloneService } from '@/services'
import type { AiChangeStatus, AiCloneForm, AiDraft } from '@/services/types'

/** The form's options for a journey: destination, interests, AI requests left today. */
export function useAiCloneOptions(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.aiClone.options(postId),
    queryFn: () => aiCloneService.getAiCloneOptions(postId),
    enabled,
    // Requests left change with every AI call.
    staleTime: 0,
  })
}

/** An AI clone of this journey, or with `mergeWith` an AI merge of it and those. */
export function useCreateAiDraft(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ form, mergeWith }: { form: AiCloneForm; mergeWith: string[] }) =>
      mergeWith.length
        ? aiCloneService.createAiMerge([postId, ...mergeWith], form)
        : aiCloneService.createAiDraft(postId, form),
    onSuccess: (draft) => {
      queryClient.setQueryData(qk.aiClone.draft(draft._id), draft)
      void queryClient.invalidateQueries({ queryKey: qk.aiClone.options(postId) })
    },
  })
}

export function useAiDraft(id: string | undefined) {
  return useQuery({
    queryKey: qk.aiClone.draft(id ?? ''),
    queryFn: () => aiCloneService.getAiDraft(id as string),
    enabled: Boolean(id),
    retry: false,
  })
}

/**
 * Every edit answers with the whole draft, recomputed by the API: it replaces
 * the cached one. A refused edit (the draft changed in another tab, or was
 * saved) reloads it, so the page shows what is really there.
 */
function useDraftMutation<T>(id: string, run: (input: T) => Promise<AiDraft>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (draft) => queryClient.setQueryData(qk.aiClone.draft(id), draft),
    onError: () => void queryClient.invalidateQueries({ queryKey: qk.aiClone.draft(id) }),
  })
}

export function useSetChangeStatus(id: string) {
  return useDraftMutation(id, ({ changeId, status }: { changeId: string; status: AiChangeStatus }) =>
    aiCloneService.setAiChangeStatus(id, changeId, status),
  )
}

export function useAcceptAll(id: string) {
  return useDraftMutation(id, () => aiCloneService.acceptAllAiChanges(id))
}

export function useOptimizeRoute(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dayIndex: number) => aiCloneService.optimizeAiRoute(id, dayIndex),
    onSuccess: ({ draft }) => queryClient.setQueryData(qk.aiClone.draft(id), draft),
    onError: () => void queryClient.invalidateQueries({ queryKey: qk.aiClone.draft(id) }),
  })
}

export function useCreateChecklist(id: string) {
  return useDraftMutation(id, () => aiCloneService.createAiChecklist(id))
}

export function useAiChat(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => aiCloneService.sendAiChat(id, message),
    onSuccess: ({ draft }) => queryClient.setQueryData(qk.aiClone.draft(id), draft),
  })
}

export function useCommitDraft(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) => aiCloneService.commitAiDraft(id, title),
    onSuccess: (itinerary) => {
      queryClient.setQueryData<AiDraft>(qk.aiClone.draft(id), (draft) =>
        draft ? { ...draft, committedItineraryId: itinerary._id } : draft,
      )
      void queryClient.invalidateQueries({ queryKey: qk.itinerary.all })
      void queryClient.invalidateQueries({ queryKey: qk.post.all })
    },
  })
}
