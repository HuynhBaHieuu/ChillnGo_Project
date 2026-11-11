import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'

import { newsService } from '@/services'
import type { NewsPage } from '@/services/news.service'
import type { NewsItem, Region } from '@/services/types'
import { useViewerId } from '@/store'

/** Published travel news, newest first, a page at a time. */
export function useNews(region?: Region, enabled = true) {
  const viewerId = useViewerId()
  return useInfiniteQuery({
    queryKey: ['news', region ?? 'all', viewerId],
    queryFn: ({ pageParam }) => newsService.getNews({ region, before: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
    staleTime: 60_000,
  })
}

export function useSavedNews(enabled = true) {
  const viewerId = useViewerId()
  return useQuery({
    queryKey: ['news', 'saved', viewerId],
    queryFn: newsService.getSavedNews,
    enabled: enabled && Boolean(viewerId),
  })
}

/** Saves or unsaves a news item, updating every cached list at once. */
export function useToggleSaveNews() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => newsService.toggleSave(id),
    onSuccess: (saved, id) => {
      queryClient.setQueriesData<InfiniteData<NewsPage>>({ queryKey: ['news'] }, (data) => {
        if (!data || !('pages' in data)) return data
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item: NewsItem) => (item._id === id ? { ...item, savedByMe: saved } : item)),
          })),
        }
      })
      void queryClient.invalidateQueries({ queryKey: ['news', 'saved'] })
    },
  })
}
