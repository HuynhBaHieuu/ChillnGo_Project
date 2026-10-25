import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Film, Loader2, Radio, Users, Video } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LivestreamCard } from '@/features/livestream/LivestreamCard'
import { LivestreamSetupDialog } from '@/features/livestream/LivestreamSetupDialog'
import { ReplayCard } from '@/features/livestream/ReplayCard'
import { useLiveNow } from '@/features/livestream/useLiveNow'
import { livestreamService, socialService } from '@/services'
import type { Livestream } from '@/services/livestream.service'
import { useAuthStore, useViewerId } from '@/store'
import { t } from '@/i18n'

type LiveTab = 'all' | 'following'

/**
 * /live: streams running now, then recorded ones to watch again.
 *   "Đề xuất"        everyone you may watch
 *   "Đang theo dõi"  only the people you follow (signed in)
 * The tab is kept in the address (?tab=following).
 */
export function LiveNowPage() {
  const user = useAuthStore((s) => s.user)
  const viewerId = useViewerId()
  const [params, setParams] = useSearchParams()
  const tab: LiveTab = params.get('tab') === 'following' && viewerId ? 'following' : 'all'
  const [goingLive, setGoingLive] = useState(false)

  // Same query as the Newsfeed: shared cache.
  const following = useQuery({
    queryKey: ['following', viewerId],
    queryFn: () => socialService.getFollowingIds(viewerId as string),
    enabled: Boolean(viewerId),
  })
  const followingIds = following.data ?? []

  const everyone = useLiveNow()
  const followed = useQuery({
    queryKey: ['livestreams', 'following', followingIds.join(',')],
    queryFn: () => livestreamService.listLive(followingIds),
    enabled: tab === 'following' && following.isSuccess && followingIds.length > 0,
    refetchInterval: 30_000,
  })
  // Badge on the tab, from what is already loaded.
  const followedLiveCount = everyone.data?.filter((s) => followingIds.includes(s.host._id)).length ?? 0

  const goLive = user && (
    <GlassButton size="md" tone="sunset" onClick={() => setGoingLive(true)}>
      <Video />
      {t('Phát trực tiếp')}
    </GlassButton>
  )

  const noFollows = tab === 'following' && following.isSuccess && followingIds.length === 0
  const showAll = (
    <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
      {t('Xem đề xuất')}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title={t('Đang live')}
        description={t('Những chuyến đi đang được phát trực tiếp trên ChillnGo, và các buổi đã phát để xem lại.')}
        action={goLive}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setParams(value === 'following' ? { tab: 'following' } : {}, { replace: true })}
      >
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="all">
            {t('Đề xuất')}
            <Count n={everyone.data?.length ?? 0} />
          </TabsTrigger>
          {viewerId && (
            <TabsTrigger value="following">
              {t('Đang theo dõi')}
              <Count n={followedLiveCount} />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-8">
          <LiveSection
            streams={everyone.data}
            pending={everyone.isPending}
            error={everyone.error}
            empty={
              <EmptyState
                icon={Radio}
                title={t('Chưa có ai đang live')}
                description={t('Khi có người bắt đầu phát trực tiếp, buổi phát sẽ hiện ở đây. Trang tự cập nhật, bạn không cần tải lại.')}
                action={goLive}
              />
            }
          />
          <ReplaySection key="all" />
        </TabsContent>

        {viewerId && (
          <TabsContent value="following" className="mt-8">
            {noFollows ? (
              <EmptyState
                icon={Users}
                title={t('Bạn chưa theo dõi ai')}
                description={t('Theo dõi những người đi cùng gu để thấy ngay khi họ phát trực tiếp.')}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {showAll}
                    <Button asChild variant="outline">
                      <Link to="/discover">{t('Khám phá')}</Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <>
                <LiveSection
                  streams={followed.data}
                  pending={!following.isSuccess || followed.isPending}
                  error={following.error ?? followed.error}
                  empty={
                    <EmptyState
                      icon={Radio}
                      title={t('Chưa có ai bạn theo dõi đang live')}
                      description={t('Bạn sẽ nhận thông báo khi họ bắt đầu phát. Trong lúc chờ, xem những buổi đang phát khác nhé.')}
                      action={showAll}
                    />
                  }
                />
                {following.isSuccess && <ReplaySection key={`following:${followingIds.join(',')}`} authors={followingIds} />}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {user && <LivestreamSetupDialog open={goingLive} onOpenChange={setGoingLive} user={user} />}
    </PageContainer>
  )
}

function Count({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-np-social px-1.5 text-[10px] font-bold leading-5 text-np-ink">
      {n}
    </span>
  )
}

function LiveSection({
  streams,
  pending,
  error,
  empty,
}: {
  streams: Livestream[] | undefined
  pending: boolean
  error: unknown
  empty: React.ReactNode
}) {
  return (
    <section aria-labelledby="live-now-heading" className="space-y-5">
      <h2 id="live-now-heading" className="flex items-center gap-2 font-display text-2xl">
        <Radio className="size-5 text-np-social" aria-hidden />
        {t('Đang phát')}
      </h2>

      {error ? (
        <EmptyState title={t('Không tải được danh sách livestream')} description={(error as Error).message} />
      ) : pending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : streams?.length ? (
        <div className="animate-fade-rise-delay grid gap-6 lg:grid-cols-2">
          {streams.map((stream) => (
            <LivestreamCard key={stream._id} stream={stream} featured />
          ))}
        </div>
      ) : (
        empty
      )}
    </section>
  )
}

/** Recorded streams that are over; everyone's, or only `authors`'. */
function ReplaySection({ authors }: { authors?: string[] }) {
  const replays = useInfiniteQuery({
    queryKey: ['livestreams', 'replays', authors ? authors.join(',') : 'everyone'],
    queryFn: ({ pageParam }) => livestreamService.listReplays(authors, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  })
  const past = replays.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <section aria-labelledby="replays-heading" className="mt-14 space-y-5">
      <h2 id="replays-heading" className="flex items-center gap-2 font-display text-2xl">
        <Film className="size-5" aria-hidden />
        {t('Xem lại')}
      </h2>

      {replays.isPending && (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {replays.isError && <EmptyState title={t('Không tải được các buổi xem lại')} description={(replays.error as Error).message} />}

      {replays.isSuccess && past.length === 0 && (
        <EmptyState
          icon={Film}
          title={t('Chưa có buổi nào để xem lại')}
          description={t('Buổi phát có bật "Lưu lại buổi phát" sẽ xuất hiện ở đây sau khi kết thúc.')}
        />
      )}

      {past.length > 0 && (
        <div className="grid gap-4">
          {past.map((stream) => (
            <ReplayCard key={stream._id} stream={stream} showHost featured />
          ))}
        </div>
      )}

      {replays.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void replays.fetchNextPage()} disabled={replays.isFetchingNextPage}>
            {replays.isFetchingNextPage && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('Xem thêm')}
          </Button>
        </div>
      )}
    </section>
  )
}
