import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { livestreamService } from '@/services'

/** Visible for this long before connecting, so scrolling past does not open a connection. */
const SETTLE_MS = 600
/** Out of view for this long before disconnecting, so a small scroll back does not reconnect. */
const LINGER_MS = 4000

/**
 * The muted, low-quality moving picture on a Newsfeed live card.
 *
 * It joins with a hidden preview token (server: POST /:id/preview): the host
 * and the viewers never see it, and it is never counted as a viewer. Only the
 * host's camera is received, at the lowest quality, and only while the card
 * is on screen. LiveKit's library is loaded on first use, so the Newsfeed
 * itself stays light. Any failure simply leaves the poster underneath.
 */
export function LivePreview({ streamId, hostId, className }: { streamId: string; hostId: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Save-data users and reduced-motion users keep the still poster.
  const allowed = !(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const el = box.current
    if (!el || !allowed || !('IntersectionObserver' in window)) return
    let timer: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer)
        const visible = entry.intersectionRatio >= 0.5
        timer = window.setTimeout(() => setInView(visible), visible ? SETTLE_MS : LINGER_MS)
      },
      { threshold: [0, 0.5] },
    )
    observer.observe(el)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [allowed])

  useEffect(() => {
    if (!inView) return
    let disposed = false
    let leave: (() => void) | undefined

    void (async () => {
      try {
        const [{ Room, RoomEvent, Track, VideoQuality }, connection] = await Promise.all([
          import('livekit-client'),
          livestreamService.getPreviewConnection(streamId),
        ])
        if (disposed) return
        const room = new Room({ adaptiveStream: true })
        leave = () => void room.disconnect(true)

        // Only the host's camera, only the smallest layer; never the sound.
        const want = (pub: import('livekit-client').RemoteTrackPublication, identity: string) => {
          if (identity !== hostId || pub.source !== Track.Source.Camera) return
          pub.setSubscribed(true)
          pub.setVideoQuality(VideoQuality.LOW)
        }
        room
          .on(RoomEvent.TrackPublished, (pub, participant) => want(pub, participant.identity))
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Video && video.current) track.attach(video.current)
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach()
            setPlaying(false)
          })
          .on(RoomEvent.TrackMuted, (pub) => pub.kind === Track.Kind.Video && setPlaying(false))
          .on(RoomEvent.Disconnected, () => setPlaying(false))

        await room.connect(connection.url, connection.token, { autoSubscribe: false })
        if (disposed) {
          leave()
          return
        }
        for (const p of room.remoteParticipants.values()) {
          for (const pub of p.trackPublications.values()) want(pub, p.identity)
        }
      } catch {
        // No preview (ended, blocked, network): the poster stays.
      }
    })()

    return () => {
      disposed = true
      leave?.()
      setPlaying(false)
    }
  }, [inView, streamId, hostId])

  return (
    <div ref={box} className={cn('absolute inset-0', className)} aria-hidden>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        onPlaying={() => setPlaying(true)}
        className={cn('size-full object-cover transition-opacity duration-700', playing ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
