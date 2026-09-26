import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Mic, MicOff, Radio, VideoOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { mediaErrorMessage } from '@/features/livestream/media'
import type { DevicePick } from '@/features/livestream/media'
import { ApiError, livestreamService } from '@/services'
import type { LiveAudience, LiveConnection } from '@/services/livestream.service'
import type { User } from '@/services/types'

const NO_CAMERA = 'none'
const TITLE_MAX = 100
const DESCRIPTION_MAX = 500

/** What the live page needs from the setup, passed through router state. */
export interface LiveStartState {
  connection: LiveConnection
  devices: DevicePick
}

export function LivestreamSetupDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-xl">
        {/* Mounted only while open: closing it releases the camera and microphone. */}
        {open && <SetupForm user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

type Access = 'asking' | 'ready' | 'blocked'

function SetupForm({ user, onDone }: { user: User; onDone: () => void }) {
  const navigate = useNavigate()
  const videoEl = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState<LiveAudience>('public')
  const [record, setRecord] = useState(true)
  // Recording is offered only when the server has somewhere to store it.
  const config = useQuery({ queryKey: ['livestreams', 'config'], queryFn: livestreamService.getConfig, staleTime: 5 * 60_000 })
  const canRecord = config.data?.recording === true

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [videoId, setVideoId] = useState<string>('')
  const [audioId, setAudioId] = useState<string>('')
  const supported = Boolean(navigator.mediaDevices?.getUserMedia)
  const [access, setAccess] = useState<Access>(supported ? 'asking' : 'blocked')
  const [notice, setNotice] = useState<string | null>(
    supported ? null : 'Trình duyệt này không hỗ trợ camera. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.',
  )
  const [hasMic, setHasMic] = useState(false)
  const level = useMicLevel(streamRef, access)

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoEl.current) videoEl.current.srcObject = null
  }, [])

  /**
   * Opens camera + microphone for the preview; falls back to audio only without
   * a camera. Callers reacting to a click set access to "asking" first.
   */
  const openDevices = useCallback(
    async (wantVideo: string, wantAudio: string) => {
      stopPreview()
      const video = wantVideo === NO_CAMERA ? false : wantVideo ? { deviceId: { exact: wantVideo } } : true
      const audio = wantAudio ? { deviceId: { exact: wantAudio } } : true

      let stream: MediaStream | null = null
      let message: string | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio })
      } catch (error) {
        const name = (error as { name?: string }).name
        if (video && (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError')) {
          // No usable camera: try sound only.
          stream = await navigator.mediaDevices.getUserMedia({ audio }).catch(() => null)
          message = stream ? 'Không dùng được camera. Livestream sẽ chỉ có âm thanh.' : mediaErrorMessage(error)
        } else {
          message = mediaErrorMessage(error)
        }
      }

      setNotice(message)
      if (!stream) {
        setAccess('blocked')
        return
      }
      streamRef.current = stream
      if (videoEl.current) videoEl.current.srcObject = stream

      // Device names are only visible after permission is granted.
      const all = await navigator.mediaDevices.enumerateDevices()
      setCameras(all.filter((d) => d.kind === 'videoinput' && d.deviceId))
      setMics(all.filter((d) => d.kind === 'audioinput' && d.deviceId))
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      setVideoId(videoTrack?.getSettings().deviceId ?? NO_CAMERA)
      setAudioId(audioTrack?.getSettings().deviceId ?? '')
      setHasMic(Boolean(audioTrack))
      setAccess('ready')
    },
    [stopPreview],
  )

  useEffect(() => {
    if (!supported) return
    // Syncing with the camera/microphone: state is only set after the browser answers.
    // oxlint-disable-next-line react/set-state-in-effect
    void openDevices('', '')
    return stopPreview
  }, [supported, openDevices, stopPreview])

  const start = useMutation({
    mutationFn: () => livestreamService.startLivestream({
        title: title.trim(),
        description: description.trim(),
        audience,
        record: canRecord && record,
      }),
    onSuccess: ({ livestream, connection }) => {
      const devices: DevicePick = {
        videoDeviceId: videoId === NO_CAMERA || !videoId ? null : videoId,
        audioDeviceId: audioId || null,
      }
      // Hand the camera over to the live page.
      stopPreview()
      onDone()
      void navigate(`/live/${livestream._id}`, { state: { connection, devices } satisfies LiveStartState })
    },
  })

  const cameraOff = videoId === NO_CAMERA
  const canGoLive = access === 'ready' && title.trim().length > 0 && !start.isPending

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canGoLive) start.mutate()
  }

  const startError =
    start.error instanceof ApiError && start.error.code === 'ALREADY_LIVE'
      ? 'Bạn đang có một livestream khác. Hãy kết thúc nó trước khi phát buổi mới.'
      : (start.error as Error | null)?.message

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Bắt đầu livestream</DialogTitle>
        <DialogDescription>Kiểm tra hình và tiếng trước khi phát trực tiếp, {user.displayName}.</DialogDescription>
      </DialogHeader>

      {/* Preview */}
      <div className="relative aspect-video overflow-hidden rounded-2xl border-2 border-foreground bg-foreground">
        <video
          ref={videoEl}
          autoPlay
          muted
          playsInline
          className={`size-full -scale-x-100 object-cover ${cameraOff || access !== 'ready' ? 'invisible' : ''}`}
        />
        {(cameraOff || access !== 'ready') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-background">
            {access === 'asking' ? (
              <>
                <Loader2 className="size-6 animate-spin" aria-hidden />
                Đang xin quyền dùng camera và micro…
              </>
            ) : access === 'blocked' ? (
              <>
                <VideoOff className="size-7" aria-hidden />
                {notice}
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                    setAccess('asking')
                    void openDevices('', '')
                  }}>
                  Thử lại
                </Button>
              </>
            ) : (
              <>
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-20 rounded-full border-2 border-background object-cover" />
                Chỉ phát âm thanh
              </>
            )}
          </div>
        )}
        {access === 'ready' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full bg-foreground/70 px-3 py-1 text-xs text-background">
            {hasMic ? <Mic className="size-3.5" aria-hidden /> : <MicOff className="size-3.5" aria-hidden />}
            <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-background/30" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full bg-sunset transition-[width] duration-100" style={{ width: `${level}%` }} />
            </span>
            <span className="sr-only">{hasMic ? 'Micro đang nhận âm thanh' : 'Không có micro'}</span>
          </div>
        )}
      </div>
      {access === 'ready' && notice && <p className="text-xs text-muted-foreground">{notice}</p>}

      {/* Devices */}
      {access === 'ready' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Camera</Label>
            <Select value={videoId} onValueChange={(v) => {
                setVideoId(v)
                setAccess('asking')
                void openDevices(v, audioId)
              }}>
              <SelectTrigger aria-label="Chọn camera">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((c, i) => (
                  <SelectItem key={c.deviceId} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </SelectItem>
                ))}
                <SelectItem value={NO_CAMERA}>Không dùng camera (chỉ âm thanh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Micro</Label>
            <Select value={audioId} onValueChange={(v) => {
                setAudioId(v)
                setAccess('asking')
                void openDevices(videoId, v)
              }} disabled={mics.length === 0}>
              <SelectTrigger aria-label="Chọn micro">
                <SelectValue placeholder="Không có micro" />
              </SelectTrigger>
              <SelectContent>
                {mics.map((m, i) => (
                  <SelectItem key={m.deviceId} value={m.deviceId}>
                    {m.label || `Micro ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-1.5">
        <Label htmlFor="live-title">Tiêu đề</Label>
        <Input id="live-title" required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="live-description">Mô tả (không bắt buộc)</Label>
        <Textarea
          id="live-description"
          rows={2}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Ai được xem</Label>
        <Select value={audience} onValueChange={(v) => setAudience(v as LiveAudience)}>
          <SelectTrigger aria-label="Ai được xem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Công khai: mọi người đã đăng nhập</SelectItem>
            <SelectItem value="followers">Người theo dõi: chỉ những ai theo dõi bạn</SelectItem>
            <SelectItem value="private">Chỉ mình tôi: để phát thử</SelectItem>
          </SelectContent>
        </Select>
        {audience !== 'private' && (
          <p className="text-xs text-muted-foreground">Người theo dõi bạn sẽ nhận được thông báo khi bạn bắt đầu phát.</p>
        )}
      </div>

      {canRecord && (
        <label htmlFor="live-record" className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/10 p-3 hover:bg-muted/60">
          <Checkbox id="live-record" checked={record} onCheckedChange={(checked) => setRecord(checked === true)} className="mt-0.5" />
          <span className="text-sm">
            <span className="block font-semibold">Lưu lại buổi phát</span>
            <span className="block text-xs text-muted-foreground">
              Sau khi kết thúc, mọi người được xem lại trên trang cá nhân của bạn (cùng chế độ người xem như trên).
            </span>
          </span>
        </label>
      )}

      {startError && (
        <p role="alert" className="text-sm text-destructive">
          {startError}
        </p>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={start.isPending}>
          Huỷ
        </Button>
        <Button type="submit" disabled={!canGoLive}>
          {start.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radio className="size-4" aria-hidden />}
          Phát trực tiếp
        </Button>
      </DialogFooter>
    </form>
  )
}

/** 0–100 microphone level for the preview's meter, so people can see the mic works. */
function useMicLevel(streamRef: React.RefObject<MediaStream | null>, access: Access): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    const stream = streamRef.current
    if (access !== 'ready' || !stream?.getAudioTracks().length) return
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const average = data.reduce((sum, v) => sum + v, 0) / data.length
      setLevel(Math.min(100, Math.round((average / 128) * 100)))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(frame)
      void ctx.close()
    }
  }, [streamRef, access])
  return level
}
