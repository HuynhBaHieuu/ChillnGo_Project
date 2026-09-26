import { useQuery } from '@tanstack/react-query'

import { livestreamService } from '@/services'

/**
 * Every public stream live right now, whoever the host is. Shared by the
 * navbar count, the Newsfeed strip and the "Đang live" page (one request,
 * one cache entry). Polled: streams start and end all the time.
 */
export function useLiveNow() {
  return useQuery({
    queryKey: ['livestreams', 'all'],
    queryFn: () => livestreamService.listLive(),
    refetchInterval: 30_000,
  })
}
