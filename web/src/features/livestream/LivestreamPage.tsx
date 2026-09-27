import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, History, Loader2, Mic, MicOff, PhoneOff, RefreshCw, SwitchCamera, Video, VideoOff, Volume2, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type * as React from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/discovery-admin/admin/shared'
import { DvrBar } from '@/features/livestream/DvrBar'
import { LiveClock, ViewerCount } from '@/features/livestream/LiveBadge'
import { LiveComments } from '@/features/livestream/LiveComments'
import { LiveEnded } from '@/features/livestream/LiveEnded'
import { REACTIONS, compact, totalReactions, useFloatingReactions } from '@/features/livestream/live-format'
import { FloatingReactions, ReactionBar } from '@/features/livestream/LiveReactions'
import type { LiveStartState } from '@/features/livestream/LivestreamSetupDialog'
import { useDvr } from '@/features/livestream/useDvr'
import { useLiveRoom } from '@/features/livestream/useLiveRoom'
import { FollowButton } from '@/features/social/components/FollowButton'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError, livestreamService } from '@/services'
import { showComment } from '@/services/livestream.service'
import type { LiveComment, LiveConnection, Livestream, ReactionKind } from '@/services/livestream.service'
import { useAuthStore } from '@/store'

const AUDIENCE_NOTE: Record<Livestream['audience'], string | null> = {
  public: null,
  followers: 'Chỉ người theo dõi',
  private: 'Chỉ mình bạn xem được',
}

/**
 * /live/:id — the host's broadcast view or a viewer's watch view (decided by
 * the server's token) while live; the replay and statistics once it is over.
 */
export function LivestreamPage() {
  const { id = '' } = useParams<{ id: string }>()
  const stream = useQuery({
    queryKey: ['livestream', id],
    queryFn: () => livestreamService.getLivestream(id),
    retry: false,
    // While live, each check also lets the server re-measure the audience (peak viewers).
    refetchInterval: (query) => (query.state.data?.status === 'live' ? 15_000 : false),
  })

  if (stream.isPending) {
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Đang mở livestream…
        </p>
      </Shell>
    )
  }
  if (stream.isError) {
    return (
      <Shell>
        <Notice title="Không mở được livestream" text={(stream.error as Error).message} />
      </Shell>
    )
  }
  if (stream.data.blockedMe) {
    return (
      <Shell>
        <Notice title="Bạn không xem được livestream này" text="Người phát đã chặn bạn khỏi buổi phát này." />
      </Shell>
    )
  }
  return (
    <Shell>
      {stream.data.status === 'ended' ? (
        <LiveEnded key={stream.data._id} initial={stream.data} />
      ) : (
        <LiveView key={stream.data._id} stream={stream.data} fetchedAt={stream.dataUpdatedAt} />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  // pb-36 on phones keeps the comment box above the fixed bottom navigation.
  return <div className="np-page min-h-screen bg-[hsl(var(--background))] px-4 pb-36 pt-28 text-foreground sm:px-6 md:pb-16">{children}</div>
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border-2 border-foreground bg-card p-8 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <GlassButton asChild tone="sunset">
        <Link to="/feed">Về Newsfeed</Link>
      </GlassButton>
    </div>
  )
}

/** `fetchedAt`: when `stream` came from the server; the live clock counts on from its durationSec. */
function LiveView({ stream, fetchedAt }: { stream: Livestream; fetchedAt: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)

  // A connection handed over by the setup dialog; cleared from history so a
  // reload asks the server for a fresh token instead of reusing this one.
  const [handoff] = useState(() => location.state as LiveStartState | null)
  useEffect(() => {
    if (location.state) void navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  /**
   * Over: ask the server for the final record. The page then switches to the
   * replay and statistics. `ended` covers the moment until it answers (or a
   * server that still says "live" for a second).
   */
  const [ended, setEnded] = useState(false)
  const [removed, setRemoved] = useState(false)
  const finish = useCallback(() => {
    setEnded(true)
    void queryClient.invalidateQueries({ queryKey: ['livestream', stream._id] })
    void queryClient.invalidateQueries({ queryKey: ['livestreams'] })
  }, [queryClient, stream._id])

  const fetched = useQuery({
    queryKey: ['livestream-connection', stream._id],
    queryFn: () => livestreamService.getConnection(stream._id),
    enabled: !handoff && !ended && !removed,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })
  const connection: LiveConnection | null = ended || removed ? null : (handoff?.connection ?? fetched.data ?? null)
  const fetchError = fetched.error instanceof ApiError ? fetched.error : null
  // Ended before we got in (e.g. a stale link): fetch the final record.
  const endedBeforeJoin = fetchError?.code === 'LIVE_ENDED'
  useEffect(() => {
    if (endedBeforeJoin) void queryClient.invalidateQueries({ queryKey: ['livestream', stream._id] })
  }, [endedBeforeJoin, queryClient, stream._id])
  const blocked = removed || fetchError?.code === 'LIVE_BLOCKED'

  // Comments: history once, then whatever arrives live, without duplicates or removed ones.
  const history = useQuery({
    queryKey: ['livestream-comments', stream._id],
    queryFn: () => livestreamService.listComments(stream._id),
  })
  const [arrived, setArrived] = useState<LiveComment[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const addComment = useCallback((comment: LiveComment) => {
    const shown = showComment(comment)
    setArrived((current) => (current.some((c) => c._id === shown._id) ? current : [...current, shown]))
  }, [])
  const dropComments = useCallback((ids: string[]) => setRemovedIds((current) => [...current, ...ids]), [])
  const comments = [...(history.data ?? []), ...arrived.filter((a) => !history.data?.some((h) => h._id === a._id))].filter(
    (c) => !removedIds.includes(c._id),
  )

  // Reactions: everyone's float over the video; your own show the moment you tap.
  const floating = useFloatingReactions()
  const [reactionCounts, setReactionCounts] = useState(stream.reactions)
  const countReaction = useCallback((kind: ReactionKind, count: number) => {
    setReactionCounts((current) => ({ ...current, [kind]: current[kind] + count }))
  }, [])
  const onReaction = useCallback(
    (kind: ReactionKind, count: number, userId: string) => {
      if (userId === me?._id) return // already shown and counted when tapped
      floating.add(kind, count)
      countReaction(kind, count)
    },
    [me?._id, floating, countReaction],
  )

  // Refs apart from values, so render code never reads a ref.
  const { videoRef, audioBox, ...room } = useLiveRoom({
    connection,
    hostId: stream.host._id,
    devices: handoff?.devices,
    onComment: addComment,
    onCommentsRemoved: dropComments,
    onReaction,
    onEnded: finish,
    onRemoved: () => setRemoved(true),
  })
  const isHost = room.isHost || me?._id === stream.host._id

  // Rewinding (viewers of a recorded stream). The live connection stays up
  // underneath, for comments and reactions; only its sound is silenced.
  const { videoRef: rewindVideoRef, ...rewind } = useDvr(stream._id, stream.startedAt)
  const rewinding = rewind.mode === 'dvr'
  const { muteLiveAudio } = room
  useEffect(() => {
    muteLiveAudio(rewinding)
  }, [rewinding, muteLiveAudio])
  const canRewind = stream.dvr && !isHost && Boolean(connection)

  // Leaving the page while broadcasting would silently stop the stream: ask first.
  useEffect(() => {
    if (!room.isHost || ended) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [room.isHost, ended])

  const [confirmEnd, setConfirmEnd] = useState(false)
  const end = useMutation({
    mutationFn: () => livestreamService.endLivestream(stream._id),
    onSuccess: async (final) => {
      setConfirmEnd(false)
      await room.leave() // releases camera and microphone
      queryClient.setQueryData(['livestream', stream._id], final)
      finish()
    },
  })

  // Moderation (host) and deleting your own comment.
  const [toBlock, setToBlock] = useState<LiveComment | null>(null)
  const [moderationError, setModerationError] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: (comment: LiveComment) => livestreamService.deleteComment(stream._id, comment._id),
    onSuccess: (_result, comment) => dropComments([comment._id]),
    onError: (error) => setModerationError((error as Error).message),
  })
  const block = useMutation({
    mutationFn: (userId: string) => livestreamService.blockViewer(stream._id, userId),
    onSuccess: (_result, userId) => {
      dropComments(comments.filter((c) => c.author._id === userId).map((c) => c._id))
      setToBlock(null)
    },
  })

  async function send(text: string) {
    const comment = await livestreamService.sendComment(stream._id, text)
    addComment(comment)
  }

  function tapReaction(kind: ReactionKind) {
    floating.add(kind)
    countReaction(kind, 1)
  }

  if (blocked) {
    return <Notice title="Bạn đã bị chặn" text="Người phát đã chặn bạn khỏi livestream này." />
  }

  const isOver = ended || endedBeforeJoin
  const reactionTotal = totalReactions(reactionCounts)

  return (
    <>
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Video */}
        <section className="min-w-0 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl border-2 border-foreground bg-foreground shadow-[4px_4px_0_hsl(var(--foreground))]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={room.isHost}
              className={cn('size-full object-contain', room.mirror && '-scale-x-100', (!room.hasVideo || isOver) && 'invisible')}
            />
            {/* The rewound picture, over the live one while rewinding. */}
            <video
              ref={rewindVideoRef}
              playsInline
              className={cn('absolute inset-0 size-full bg-black object-contain', (!rewinding || isOver) && 'hidden')}
            />
            <div ref={audioBox} hidden />

            {/* No picture: audio only, waiting, or over */}
            {(!room.hasVideo || isOver) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-background">
                <Avatar className="size-20 border-2 border-background">
                  <AvatarImage src={stream.host.avatarUrl} alt="" />
                  <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                {isOver ? (
                  <p className="flex items-center gap-2 font-display text-2xl">
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    Livestream đã kết thúc
                  </p>
                ) : room.state === 'connecting' || (!connection && !fetched.isError) ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Đang kết nối…
                  </p>
                ) : room.isHost && !room.camOn ? (
                  <p>Camera đang tắt. Người xem vẫn nghe được bạn.</p>
                ) : (
                  <p>{room.isHost ? 'Đang bật camera…' : 'Đang chờ hình ảnh từ người phát…'}</p>
                )}
              </div>
            )}

            {!isOver && <FloatingReactions floats={floating.floats} onDone={floating.done} />}

            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-3 text-white">
              <div className="flex flex-wrap items-center gap-2">
                {!isOver && !rewinding && <LiveClock baseSec={stream.durationSec} baseAt={fetchedAt} />}
                {!isOver && rewinding && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    <History className="size-3.5" aria-hidden />
                    Đang xem lại
                  </span>
                )}
                {!isOver && <ViewerCount count={room.viewerCount} className="rounded-full bg-black/40 px-2.5 py-1" />}
                {!isOver && reactionTotal > 0 && (
                  <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {REACTIONS.heart.emoji} {compact(reactionTotal)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => (room.isHost && !isOver ? setConfirmEnd(true) : navigate('/feed'))}
                aria-label={room.isHost && !isOver ? 'Kết thúc và rời livestream' : 'Rời livestream'}
                className="grid size-10 place-items-center rounded-full bg-black/40 hover:bg-black/60"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {room.state === 'reconnecting' && !isOver && (
              <div className="absolute inset-x-0 top-16 mx-auto flex w-fit items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
                <WifiOff className="size-3.5" aria-hidden />
                Mạng chập chờn, đang kết nối lại…
              </div>
            )}

            {!room.isHost && room.audioBlocked && !isOver && (
              <button
                type="button"
                onClick={() => void room.startAudio()}
                className={cn(
                  'absolute inset-x-0 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-lg',
                  canRewind ? 'bottom-16' : 'bottom-4',
                )}
              >
                <Volume2 className="size-4" aria-hidden />
                Bật âm thanh
              </button>
            )}

            {/* Viewers: the timeline, to rewind and come back to live. */}
            {canRewind && !isOver && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-10">
                <DvrBar
                  baseSec={stream.durationSec}
                  baseAt={fetchedAt}
                  mode={rewind.mode}
                  loading={rewind.loading}
                  paused={rewind.paused}
                  position={rewind.position}
                  availableEnd={rewind.availableEnd}
                  onRewind={(t) => void rewind.rewindTo(t)}
                  onGoLive={rewind.goLive}
                  onTogglePause={rewind.togglePause}
                />
              </div>
            )}

            {/* Host controls */}
            {room.isHost && !isOver && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-4">
                <ControlButton on={room.micOn} onClick={() => void room.toggleMic()} labelOn="Tắt micro" labelOff="Bật micro" iconOn={Mic} iconOff={MicOff} />
                <ControlButton on={room.camOn} onClick={() => void room.toggleCamera()} labelOn="Tắt camera" labelOff="Bật camera" iconOn={Video} iconOff={VideoOff} />
                {room.canSwitchCamera && room.camOn && (
                  <ControlButton on onClick={() => void room.switchCamera()} labelOn="Đổi camera" labelOff="Đổi camera" iconOn={SwitchCamera} iconOff={SwitchCamera} />
                )}
                <button
                  type="button"
                  onClick={() => setConfirmEnd(true)}
                  className="flex h-12 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-lg hover:bg-rose-700"
                >
                  <PhoneOff className="size-4" aria-hidden />
                  Kết thúc
                </button>
              </div>
            )}
          </div>

          {(room.error || (fetchError && fetchError.code !== 'LIVE_ENDED') || moderationError || rewind.error) && !isOver && (
            <p role="alert" className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {room.error ?? fetchError?.message ?? moderationError ?? rewind.error}
              {room.state === 'disconnected' && (
                <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Thử lại
                </Button>
              )}
            </p>
          )}

          {/* Reactions: viewers tap them; the host sees the running totals. */}
          {!isOver && me && !isHost && <ReactionBar streamId={stream._id} counts={reactionCounts} onTap={tapReaction} />}

          {/* Host and title */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Link to={`/users/${stream.host._id}`} className="shrink-0">
                <Avatar className="size-12">
                  <AvatarImage src={stream.host.avatarUrl} alt="" />
                  <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0">
                <h1 className="font-display text-2xl leading-tight sm:text-3xl">{stream.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link to={`/users/${stream.host._id}`} className="font-semibold text-foreground hover:underline">
                    {stream.host.displayName}
                  </Link>{' '}
                  · bắt đầu {relativeTime(stream.startedAt)}
                  {AUDIENCE_NOTE[stream.audience] && ` · ${AUDIENCE_NOTE[stream.audience]}`}
                  {stream.recording.status === 'recording' && ' · Đang được ghi lại'}
                </p>
                {stream.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{stream.description}</p>}
              </div>
            </div>
            {!isHost && me && (
              <div className="shrink-0">
                <FollowButton userId={stream.host._id} />
              </div>
            )}
          </div>
        </section>

        {/* Comments: beside the video on desktop, below it on phones */}
        <LiveComments
          comments={comments}
          onSend={send}
          disabled={isOver || !me}
          disabledReason={isOver ? 'Livestream đã kết thúc.' : 'Đăng nhập để bình luận.'}
          hostId={stream.host._id}
          meId={me?._id}
          onDelete={(comment) => {
            setModerationError(null)
            remove.mutate(comment)
          }}
          onBlock={setToBlock}
          className="h-[26rem] lg:h-[calc(100vh-9rem)] lg:max-h-[46rem]"
        />
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="Kết thúc livestream?"
        description={
          <>
            Người xem sẽ được báo là buổi phát đã kết thúc. Camera và micro sẽ tắt.
            {end.isError && <span className="mt-2 block text-destructive">{(end.error as Error).message}</span>}
          </>
        }
        confirmLabel="Kết thúc"
        destructive
        pending={end.isPending}
        onConfirm={() => end.mutate()}
      />

      <ConfirmDialog
        open={toBlock !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToBlock(null)
            block.reset()
          }
        }}
        title={toBlock ? `Chặn ${toBlock.author.displayName}?` : ''}
        description={
          <>
            <span className="flex items-start gap-2">
              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
              Người này bị đưa ra khỏi livestream, không vào xem lại, bình luận hay thả cảm xúc được nữa. Các bình luận
              của họ trong buổi phát này sẽ bị xoá.
            </span>
            {block.isError && <span className="mt-2 block text-destructive">{(block.error as Error).message}</span>}
          </>
        }
        confirmLabel="Chặn"
        destructive
        pending={block.isPending}
        onConfirm={() => toBlock && block.mutate(toBlock.author._id)}
      />
    </>
  )
}

function ControlButton({
  on,
  onClick,
  labelOn,
  labelOff,
  iconOn: IconOn,
  iconOff: IconOff,
}: {
  on: boolean
  onClick: () => void
  labelOn: string
  labelOff: string
  iconOn: React.ComponentType<{ className?: string }>
  iconOff: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? labelOn : labelOff}
      aria-pressed={!on}
      title={on ? labelOn : labelOff}
      className={cn(
        'grid size-12 place-items-center rounded-full shadow-lg transition-colors',
        on ? 'bg-white/90 text-foreground hover:bg-white' : 'bg-rose-600 text-white hover:bg-rose-700',
      )}
    >
      {on ? <IconOn className="size-5" /> : <IconOff className="size-5" />}
    </button>
  )
}
