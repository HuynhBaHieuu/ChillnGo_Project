import { ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { checkImageFile } from '@/lib/images'
import { postService } from '@/services'

/**
 * A row of photos with an "add" tile. Each file is uploaded to Cloudinary as
 * soon as it is picked (the same signed upload journeys use); `onChange` gets
 * the photo addresses.
 */
export function PhotoPicker({ value, onChange, max }: { value: string[]; onChange: (urls: string[]) => void; max: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    const urls = [...value]
    for (const file of [...files].slice(0, max - value.length)) {
      const problem = checkImageFile(file)
      if (problem) {
        setError(problem)
        continue
      }
      try {
        urls.push(await postService.uploadJourneyImage(file))
      } catch (e) {
        setError((e as Error).message)
      }
    }
    onChange(urls)
    setUploading(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="relative size-24 overflow-hidden rounded-xl border border-foreground/10">
            <img src={url} alt="" className="size-full object-cover" />
            <button
              type="button"
              aria-label={t('Xoá ảnh')}
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        ))}
        {value.length < max && (
          <Button
            type="button"
            variant="outline"
            className="size-24 flex-col gap-1 rounded-xl text-xs"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            {t('Thêm ảnh')}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => void add(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">{t('Tối đa {n} ảnh', { n: max })}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
