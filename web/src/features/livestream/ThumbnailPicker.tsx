import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { once, snapshot } from '@/features/livestream/frames'
import { formatClock } from '@/features/livestream/live-format'
import { ACCEPT_ATTRIBUTE, checkImageFile } from '@/lib/images'
import { cn } from '@/lib/utils'
import { livestreamService } from '@/services'
import type { Livestream } from '@/services/livestream.service'
import { t } from '@/i18n'

/** How many frames, evenly spread over the replay, are offered to pick from. */
const SUGGESTED_FRAMES = 6

/**
 * The host picks the replay's cover: a frame of the video (one of the
 * suggestions, or any moment on the timeline), or a photo of their own.
 */
export function ThumbnailPicker({
  stream,
  open,
  onOpenChange,
}: {
  stream: Livestream
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-2xl">
        {/* Mounted only while open, so the video is not downloaded in the background. */}
        {open && stream.recording.url && <Picker stream={stream} videoUrl={stream.recording.url} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

type Choice = { kind: 'frame' } | { kind: 'file'; file: File; preview: string }

function Picker({ stream, videoUrl, onDone }: { stream: Livestream; videoUrl: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const videoEl = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [choice, setChoice] = useState<Choice>({ kind: 'frame' })
  const [frames, setFrames] = useState<{ time: number; src: string }[]>([])
  /** The video cannot be read into a picture here (the storage refuses cross-origin reads): photos only. */
  const [framesBlocked, setFramesBlocked] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Free the photo preview when it is replaced or the dialog closes.
  useEffect(() => () => (choice.kind === 'file' ? URL.revokeObjectURL(choice.preview) : undefined), [choice])

  // The suggestions, taken from a second, hidden copy of the video so the preview stays where the host left it.
  useEffect(() => {
    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.src = videoUrl

    void (async () => {
      try {
        await once(video, 'loadedmetadata')
        const length = video.duration
        if (!Number.isFinite(length) || length <= 0) return
        const canvas = document.createElement('canvas')
        for (let i = 0; i < SUGGESTED_FRAMES && !cancelled; i++) {
          const at = (length * (i + 0.5)) / SUGGESTED_FRAMES
          video.currentTime = at
          await once(video, 'seeked')
          const src = snapshot(video, canvas, 320).toDataURL('image/jpeg', 0.7)
          if (!cancelled) setFrames((list) => [...list, { time: at, src }])
        }
      } catch (e) {
        if (!cancelled && (e as Error).name === 'SecurityError') setFramesBlocked(true)
      }
    })()

    return () => {
      cancelled = true
      video.removeAttribute('src')
      video.load()
    }
  }, [videoUrl])

  const save = useMutation({
    mutationFn: async () => {
      const file = choice.kind === 'file' ? choice.file : await captureFrame(videoEl.current)
      return livestreamService.setThumbnail(stream._id, file, setProgress)
    },
    onSuccess: (thumbnailUrl) => done(thumbnailUrl),
    onError: (e) => setError(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => livestreamService.removeThumbnail(stream._id),
    onSuccess: () => done(''),
    onError: (e) => setError(errorMessage(e)),
  })
  const busy = save.isPending || remove.isPending

  function done(thumbnailUrl: string) {
    queryClient.setQueryData<Livestream>(['livestream', stream._id], (old) => (old ? { ...old, thumbnailUrl } : old))
    // Lists that show this replay (Newsfeed, profile, "Đang live") pick up the new cover.
    void queryClient.invalidateQueries({ queryKey: ['livestreams'] })
    onDone()
  }

  function seek(at: number) {
    setChoice({ kind: 'frame' })
    setTime(at)
    if (videoEl.current) videoEl.current.currentTime = at
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkImageFile(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setChoice({ kind: 'file', file, preview: URL.createObjectURL(file) })
  }

  const canSave = choice.kind === 'file' || (!framesBlocked && duration > 0)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{t('Ảnh bìa video xem lại')}</DialogTitle>
        <DialogDescription>
          {t('Chọn một khung hình trong video, hoặc tải ảnh của bạn lên. Ảnh bìa hiện trên Newsfeed và trang cá nhân.')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-xl border-2 border-foreground bg-foreground">
          <video
            ref={videoEl}
            src={videoUrl}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="auto"
            className={cn('size-full object-contain', choice.kind === 'file' && 'invisible')}
            onLoadedMetadata={(e) => {
              const length = e.currentTarget.duration
              if (!Number.isFinite(length)) return
              setDuration(length)
              // Start on the first suggestion rather than the (often black) first frame.
              const at = length / (SUGGESTED_FRAMES * 2)
              e.currentTarget.currentTime = at
              setTime(at)
            }}
            onError={() => setFramesBlocked(true)}
            aria-label={t('Khung hình đang chọn')}
          />
          {choice.kind === 'file' && <img src={choice.preview} alt={t('Ảnh bạn vừa chọn')} className="absolute inset-0 size-full object-cover" />}
          {choice.kind === 'frame' && duration === 0 && !framesBlocked && (
            <span className="absolute inset-0 grid place-items-center text-background">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </span>
          )}
        </div>

        {framesBlocked ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {t('Không lấy được khung hình từ video này. Bạn vẫn có thể tải ảnh của mình lên.')}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Slider
                value={[time]}
                min={0}
                max={duration || 1}
                step={0.1}
                disabled={duration === 0 || busy}
                onValueChange={([at]) => seek(at)}
                aria-label={t('Chọn thời điểm trong video')}
                className="[&>span:first-child]:bg-muted"
              />
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {formatClock(time)} / {formatClock(duration)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="list" aria-label={t('Khung hình gợi ý')}>
              {Array.from({ length: SUGGESTED_FRAMES }, (_, i) => {
                const frame = frames[i]
                const selected = frame && choice.kind === 'frame' && Math.abs(frame.time - time) < 0.05
                return (
                  <div key={i} role="listitem">
                    {frame ? (
                      <button
                        type="button"
                        onClick={() => seek(frame.time)}
                        disabled={busy}
                        aria-label={t('Khung hình lúc {time}', { time: formatClock(frame.time) })}
                        aria-pressed={selected}
                        className={cn(
                          'block aspect-video w-full overflow-hidden rounded-lg border-2 transition-colors',
                          selected ? 'border-sunset' : 'border-transparent hover:border-foreground/40',
                        )}
                      >
                        <img src={frame.src} alt="" className="size-full object-cover" />
                      </button>
                    ) : (
                      <span className="block aspect-video w-full animate-pulse rounded-lg bg-muted" aria-hidden />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" accept={ACCEPT_ATTRIBUTE} className="hidden" onChange={pickFile} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            <ImageUp aria-hidden />
            {t('Tải ảnh lên')}
          </Button>
          {choice.kind === 'file' && !framesBlocked && (
            <Button type="button" variant="ghost" size="sm" onClick={() => seek(time)} disabled={busy}>
              {t('Dùng khung hình trong video')}
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {stream.thumbnailUrl ? (
          <Button type="button" variant="ghost" onClick={() => remove.mutate()} disabled={busy} className="text-destructive hover:text-destructive">
            {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            {t('Gỡ ảnh bìa')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
            {t('Huỷ')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setError(null)
              setProgress(0)
              save.mutate()
            }}
            disabled={!canSave || busy}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {save.isPending ? (progress ? t('Đang lưu {progress}%', { progress }) : t('Đang lưu')) : t('Lưu ảnh bìa')}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

/** The preview's current frame as a JPEG file, at the video's own size (capped at 1920 wide). */
async function captureFrame(video: HTMLVideoElement | null): Promise<File> {
  if (!video || !video.videoWidth) throw new Error(t('Video chưa tải xong. Vui lòng đợi một chút.'))
  const canvas = snapshot(video, document.createElement('canvas'), 1920)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error(t('Không chụp được khung hình này. Vui lòng thử lại.'))
  return new File([blob], 'cover.jpg', { type: 'image/jpeg' })
}

function errorMessage(error: unknown): string {
  if ((error as Error).name === 'SecurityError') return t('Không lấy được khung hình từ video này. Hãy tải ảnh của bạn lên.')
  return (error as Error).message || t('Không lưu được ảnh bìa. Vui lòng thử lại.')
}
