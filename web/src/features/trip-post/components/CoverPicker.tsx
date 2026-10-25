import { ImagePlus, ImageUp, Loader2, RotateCcw, Star, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { ACCEPT_ATTRIBUTE, ACCEPTED_LABEL, checkImageFile } from '@/lib/images'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { postService } from '@/services'

/** Photos a journey can carry in its header; the server enforces the same limit. */
export const MAX_COVER_IMAGES = 10

interface CoverPickerProps {
  /** The chosen photos, the cover first; empty means "use the automatic one". */
  value: string[]
  onChange: (urls: string[]) => void
  /** What the post gets when no photo is chosen, shown as the preview. */
  fallbackUrl: string
  disabled?: boolean
}

/**
 * The journey's photos: pick or drop up to 10 files, the first shown at the
 * card's 16:10 as the cover. Each image is shrunk in the browser and uploaded
 * to Cloudinary right away; `value` holds their addresses, saved with the journey.
 */
export function CoverPicker({ value, onChange, fallbackUrl, disabled = false }: CoverPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<{ index: number; total: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)

  const busy = disabled || processing !== null
  const hasOwn = value.length > 0
  const remaining = MAX_COVER_IMAGES - value.length
  const full = remaining <= 0

  async function pick(files: File[]) {
    if (files.length === 0) return
    if (full) {
      setError(t('Tối đa {n} ảnh.', { n: MAX_COVER_IMAGES }))
      return
    }
    const problems: string[] = []
    if (files.length > remaining) problems.push(t('Chỉ thêm được {n} ảnh nữa (tối đa {max}).', { n: remaining, max: MAX_COVER_IMAGES }))
    const accepted = files.slice(0, remaining).filter((file) => {
      const problem = checkImageFile(file)
      if (problem) problems.push(`${file.name}: ${problem}`)
      return !problem
    })
    setError(problems.length ? problems.join(' ') : null)

    // Uploaded one at a time; each lands in the list as soon as it is done.
    let current = value
    for (const [i, file] of accepted.entries()) {
      setProcessing({ index: i + 1, total: accepted.length })
      setProgress(0)
      try {
        current = [...current, await postService.uploadJourneyImage(file, setProgress)]
        onChange(current)
      } catch (err) {
        problems.push(`${file.name}: ${(err as Error).message}`)
        setError(problems.join(' '))
      }
    }
    setProcessing(null)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!busy) void pick([...event.dataTransfer.files])
  }

  function remove(index: number) {
    setError(null)
    onChange(value.filter((_, i) => i !== index))
  }

  function makeCover(index: number) {
    onChange([value[index], ...value.filter((_, i) => i !== index)])
  }

  const status = processing
    ? processing.total > 1
      ? t('Đang tải ảnh {index}/{total}… {progress}%', { index: processing.index, total: processing.total, progress })
      : t('Đang tải ảnh… {progress}%', { progress })
    : null

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
          src={hasOwn ? value[0] : fallbackUrl}
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
            <span className="text-sm font-semibold">{status ?? t('Bấm hoặc kéo tối đa {n} ảnh vào đây', { n: MAX_COVER_IMAGES })}</span>
            <span className="text-xs text-np-meta">{t('Chưa chọn ảnh, bài viết sẽ dùng ảnh tự động này')}</span>
          </button>
        )}

        {hasOwn && (
          <span className="absolute left-3 top-3 rounded-full bg-np-canopy/75 px-2.5 py-1 text-xs font-semibold text-np-cream">
            {t('Ảnh bìa')}
          </span>
        )}

        {hasOwn && processing && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-np-canopy/60 text-sm text-np-cream">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            {status}
          </span>
        )}
      </div>

      {hasOwn && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10" aria-label={t('Ảnh của hành trình')}>
          {value.map((url, index) => (
            <li key={url} className="group relative aspect-square overflow-hidden rounded-lg">
              <img
                src={url}
                alt={t('Ảnh {n}', { n: index + 1 })}
                referrerPolicy="no-referrer"
                className={cn('size-full object-cover', index === 0 && 'ring-2 ring-inset ring-primary')}
              />
              <div className="absolute inset-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/50 to-transparent p-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {index === 0 ? (
                  <Star className="size-4 fill-current text-np-cream" aria-label={t('Ảnh bìa')} />
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makeCover(index)}
                    className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:cursor-not-allowed"
                    aria-label={t('Đặt ảnh {n} làm ảnh bìa', { n: index + 1 })}
                    title={t('Đặt làm ảnh bìa')}
                  >
                    <Star className="size-3.5" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(index)}
                  className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:cursor-not-allowed"
                  aria-label={t('Xoá ảnh {n}', { n: index + 1 })}
                  title={t('Xoá ảnh')}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          {!full && (
            <li className="aspect-square">
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                className="grid size-full place-items-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed"
                aria-label={t('Thêm ảnh')}
              >
                {processing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          id="coverUrl"
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={busy || full}
          onClick={() => input.current?.click()}
        >
          <ImageUp className="size-4" aria-hidden />
          {hasOwn ? t('Thêm ảnh ({n}/{max})', { n: value.length, max: MAX_COVER_IMAGES }) : t('Chọn ảnh')}
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
              onChange([])
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t('Dùng ảnh tự động')}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {t('Tối đa {n} ảnh, ảnh đầu tiên là ảnh bìa. {formats}, mỗi ảnh tối đa 15 MB. Ảnh được tự nén.', { n: MAX_COVER_IMAGES, formats: ACCEPTED_LABEL })}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-label={t('Chọn ảnh cho hành trình')}
        onChange={(e) => {
          void pick([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </div>
  )
}
