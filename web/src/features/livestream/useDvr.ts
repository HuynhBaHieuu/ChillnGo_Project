/**
 * Rewinding a live stream (DVR). The live picture comes over WebRTC, which
 * keeps nothing to go back to; while a stream is recorded, LiveKit also
 * uploads it as HLS segments every few seconds, and this plays those.
 *
 * Positions are "seconds since the stream started", the same numbers as the
 * live clock. `offset` maps them to the HLS player's own time (the recording
 * starts a moment after the stream does).
 *
 * hls.js is loaded on first use only. Safari without Media Source falls back
 * to its built-in HLS player.
 */

import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, livestreamService } from '@/services'
import { t } from '@/i18n'

export type DvrMode = 'live' | 'dvr'

function seekableEnd(video: HTMLVideoElement): number {
  const ranges = video.seekable
  return ranges.length ? ranges.end(ranges.length - 1) : video.duration || 0
}

function waitFor(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
      reject(new Error('media'))
    }
    video.addEventListener(event, done)
    video.addEventListener('error', fail)
  })
}

function dvrErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'DVR_UNAVAILABLE') return t('Buổi phát này không được ghi lại nên không tua được.')
  if ((error as Error).message === 'not-ready') return t('Chưa có đoạn nào để tua. Thử lại sau vài giây nhé.')
  if ((error as Error).message === 'unsupported') return t('Trình duyệt này không hỗ trợ tua lại livestream.')
  return t('Không tải được đoạn đã phát. Vui lòng thử lại.')
}

export function useDvr(streamId: string, startedAt: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const offset = useRef(0)
  const startedAtMs = Date.parse(startedAt)

  const [mode, setMode] = useState<DvrMode>('live')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Where the rewound picture is, in seconds since the stream started. */
  const [position, setPosition] = useState(0)
  /** How far the recording reaches right now (a few seconds behind live). */
  const [availableEnd, setAvailableEnd] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)

  const release = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  useEffect(() => release, [release])

  // Follow the player: position, how much is available, paused or not.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const update = () => {
      setPosition(offset.current + video.currentTime)
      setAvailableEnd(offset.current + seekableEnd(video))
      setPaused(video.paused)
    }
    const events = ['timeupdate', 'progress', 'durationchange', 'play', 'pause', 'seeked']
    events.forEach((e) => video.addEventListener(e, update))
    return () => events.forEach((e) => video.removeEventListener(e, update))
  }, [])

  const seek = useCallback((elapsed: number) => {
    const video = videoRef.current
    if (!video) return
    const end = seekableEnd(video)
    video.currentTime = Math.min(Math.max(0, elapsed - offset.current), Math.max(0, end - 1))
    setPosition(offset.current + video.currentTime)
  }, [])

  /** Rewind to `elapsed` seconds into the stream (clamped to what has been recorded). */
  const rewindTo = useCallback(
    async (elapsed: number) => {
      const video = videoRef.current
      if (!video) return
      setError(null)
      // Already loaded: just jump.
      if (hlsRef.current || video.currentSrc) {
        seek(elapsed)
        setMode('dvr')
        void video.play().catch(() => undefined)
        return
      }

      setLoading(true)
      try {
        const url = await livestreamService.getDvrPlaylist(streamId)
        const { default: HlsPlayer } = await import('hls.js')

        if (HlsPlayer.isSupported()) {
          const hls = new HlsPlayer({ autoStartLoad: false, backBufferLength: 120 })
          hlsRef.current = hls
          await new Promise<void>((resolve, reject) => {
            hls.once(HlsPlayer.Events.LEVEL_LOADED, (_event, data) => {
              // The first segment's wall-clock time says when the recording began.
              const first = data.details.fragments[0]?.programDateTime
              if (first) offset.current = Math.max(0, (first - startedAtMs) / 1000)
              const target = Math.min(Math.max(0, elapsed - offset.current), Math.max(0, data.details.totalduration - 1))
              hls.startLoad(target)
              resolve()
            })
            hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
              if (!data.fatal) return
              reject(new Error(data.response?.code === 404 ? 'not-ready' : 'media'))
            })
            hls.loadSource(url)
            hls.attachMedia(video)
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
          await waitFor(video, 'loadedmetadata')
          const start = (video as HTMLVideoElement & { getStartDate?: () => Date }).getStartDate?.()
          if (start && !Number.isNaN(start.getTime())) offset.current = Math.max(0, (start.getTime() - startedAtMs) / 1000)
          seek(elapsed)
        } else {
          throw new Error('unsupported')
        }

        setMode('dvr')
        await video.play().catch(() => undefined)
      } catch (e) {
        release()
        setMode('live')
        setError(dvrErrorMessage(e))
      } finally {
        setLoading(false)
      }
    },
    [streamId, startedAtMs, seek, release],
  )

  /** Back to the real-time picture. */
  const goLive = useCallback(() => {
    release()
    setMode('live')
    setError(null)
  }, [release])

  const togglePause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
  }, [])

  return { videoRef, mode, loading, error, position, availableEnd, paused, rewindTo, seek, goLive, togglePause }
}
