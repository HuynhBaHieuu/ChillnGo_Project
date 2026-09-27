import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LivestreamCard } from '@/features/livestream/LivestreamCard'
import { ReplayCard } from '@/features/livestream/ReplayCard'
import { livestreamService } from '@/services'

/**
 * The "Livestream" tab of a profile: the stream running right now, if any,
 * then past streams with their statistics and replays. Visibility follows
 * each stream's audience (the server filters).
 */
export function LiveHistory({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const live = useQuery({
    queryKey: ['livestreams', 'host', userId],
    queryFn: () => livestreamService.listLive([userId]),
    refetchInterval: 30_000,
  })
  const history = useInfiniteQuery({
    queryKey: ['livestreams', 'history', userId],
    queryFn: ({ pageParam }) => livestreamService.listHistory(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  })
  const past = history.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-6">
      {live.data?.map((stream) => (
        <LivestreamCard key={stream._id} stream={stream} featured />
      ))}

      {history.isPending && (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {history.isError && <EmptyState title="Không tải được các buổi phát" description={(history.error as Error).message} />}

      {history.isSuccess && past.length === 0 && !live.data?.length && (
        <EmptyState
          icon={Radio}
          title="Chưa có buổi phát nào"
          description={
            isOwn
              ? 'Bấm "Livestream" ở ô đăng bài trên Newsfeed để phát trực tiếp lần đầu. Các buổi phát sẽ được lưu ở đây.'
              : 'Người dùng này chưa phát trực tiếp lần nào.'
          }
          action={
            isOwn ? (
              <Button asChild variant="outline">
                <Link to="/feed">Tới Newsfeed</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {past.length > 0 && (
        <ul className="grid gap-4">
          {past.map((stream) => (
            <li key={stream._id}>
              <ReplayCard stream={stream} featured />
            </li>
          ))}
        </ul>
      )}

      {history.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            {history.isFetchingNextPage && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Xem thêm
          </Button>
        </div>
      )}
    </div>
  )
}

