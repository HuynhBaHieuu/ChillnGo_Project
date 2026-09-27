import { ImageUp, Loader2, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { ACCEPT_ATTRIBUTE, ACCEPTED_LABEL, checkImageFile } from '@/lib/images'
import { cn } from '@/lib/utils'
import { postService } from '@/services'

interface CoverPickerProps {
  /** The chosen cover; empty means "use the automatic one". */
  value: string
  onChange: (url: string) => void
  /** What the post gets when no cover is chosen, shown as the preview. */
  fallbackUrl: string
  disabled?: boolean
}

/**
 * The journey's cover photo: pick or drop a file, see it at the card's 16:10.
 * The image is shrunk in the browser and uploaded to Cloudinary right away;
 * `value` becomes its address, saved with the journey.
 */
export function CoverPicker({ value, onChange, fallbackUrl, disabled = false }: CoverPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)

  const busy = disabled || processing
  const hasOwn = value !== ''

  async function pick(file: File | undefined) {
    if (!file) return
    const problem = checkImageFile(file)
    setError(problem)
    if (problem) return

    setProcessing(true)
    setProgress(0)
    try {
      onChange(await postService.uploadJourneyImage(file, setProgress))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!busy) void pick(event.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'np-media relative aspect-[16/10] w-full overflow-hidden transition-shadow sm:aspect-[21/9]',
          dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <img
          src={hasOwn ? value : fallbackUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={cn('size-full object-cover', !hasOwn && 'opacity-50')}
        />

        {!hasOwn && (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-np-canopy/55 text-center text-np-cream transition-colors hover:bg-np-canopy/40 disabled:cursor-not-allowed"
          >
            <span className="grid size-12 place-items-center rounded-full border border-np-beige/20 bg-np-surface/80">
              {processing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImageUp className="size-5" aria-hidden />}
            </span>
            <span className="text-sm font-semibold">{processing ? `Đang tải ảnh lên… ${progress}%` : 'Bấm hoặc kéo ảnh vào đây'}</span>
            <span className="text-xs text-np-meta">Chưa chọn ảnh, bài viết sẽ dùng ảnh tự động này</span>
          </button>
        )}

        {hasOwn && processing && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-np-canopy/60 text-sm text-np-cream">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            {progress}%
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          id="coverUrl"
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImageUp className="size-4" aria-hidden />
          {hasOwn ? 'Đổi ảnh' : 'Chọn ảnh'}
        </Button>
        {hasOwn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => {
              setError(null)
              onChange('')
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Dùng ảnh tự động
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{ACCEPTED_LABEL}, tối đa 15 MB. Ảnh được tự nén.</p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-label="Chọn ảnh bìa"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
