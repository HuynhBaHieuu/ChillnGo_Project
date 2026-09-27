import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { FEELING_OPTIONS, feelingOption } from '@/lib/feelings'
import type { FeelingKind } from '@/lib/feelings'
import { canSearchPlaces, getDevicePosition, placeAt, searchPlaces } from '@/lib/geo'
import type { Place } from '@/lib/geo'
import { ACCEPTED_LABEL, ACCEPT_ATTRIBUTE, checkImageFile } from '@/lib/images'
import { cn } from '@/lib/utils'
import { activityService, checkinService } from '@/services'
import { MAX_CHECKIN_PHOTOS } from '@/services/checkin.service'
import type { User } from '@/services/types'

const CAPTION_MAX = 500

export type CheckInStart = 'photos' | 'feeling' | 'location'

interface CheckInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  /**
   * Where to begin: "photos" opens the file picker right away, "feeling"
   * focuses the feeling picker, "location" focuses the place search.
   */
  start: CheckInStart
}

/** "Check-in": up to four photos, a few words, and where it was taken. */
export function CheckInDialog({ open, onOpenChange, user, start }: CheckInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card sm:max-w-xl">
        {/* Mounted only while open, so every check-in starts empty. */}
        {open && <CheckInForm user={user} start={start} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

interface Picked {
  file: File
  preview: string
}

function CheckInForm({ user, start, onDone }: { user: User; start: CheckInStart; onDone: () => void }) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<Picked[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [feeling, setFeeling] = useState<string | null>(null)
  const feelingPicker = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState<number | null>(null)

  // Free the previews when the dialog closes.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  // Jump straight to what the user clicked. The file picker still counts as a
  // response to their click, so browsers allow opening it here.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (start === 'photos') fileInput.current?.click()
      else if (start === 'feeling') {
        feelingPicker.current?.scrollIntoView({ block: 'nearest' })
        feelingPicker.current?.querySelector<HTMLButtonElement>('button[aria-pressed]')?.focus()
      } else searchInput.current?.focus()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [start])

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = MAX_CHECKIN_PHOTOS - photos.length
    const files = Array.from(list)
    const problems = files.map(checkImageFile).filter(Boolean)
    const usable = files.filter((f) => !checkImageFile(f)).slice(0, room)

    setPhotoError(
      problems[0] ??
        (files.length - problems.length > room ? `Mỗi check-in tối đa ${MAX_CHECKIN_PHOTOS} ảnh.` : null),
    )
    setPhotos((current) => [...current, ...usable.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, i) => i !== index)
    })
  }

  const post = useMutation({
    mutationFn: () =>
      checkinService.createCheckIn(
        { files: photos.map((p) => p.file), caption, feeling, location: place },
        setProgress,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkins'] })
      onDone()
    },
    onSettled: () => setProgress(null),
  })

  // A check-in needs something to show: photos, a feeling, or a few words.
  const hasContent = photos.length > 0 || feeling !== null || caption.trim().length > 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (hasContent) post.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Check-in</DialogTitle>
        <DialogDescription>
          Chia sẻ nơi bạn đang đến và cảm xúc lúc này, {user.displayName}.
        </DialogDescription>
      </DialogHeader>

      {/* Photos */}
      <section className="space-y-2">
        <p className="text-sm font-medium">Ảnh</p>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <div key={photo.preview} className="relative aspect-square overflow-hidden rounded-xl border border-foreground/10">
              <img src={photo.preview} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                disabled={post.isPending}
                aria-label={`Bỏ ảnh ${index + 1}`}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-foreground/80 text-background hover:bg-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MAX_CHECKIN_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={post.isPending}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-foreground/25 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
            >
              <ImagePlus className="size-6 text-emerald-600" aria-hidden />
              Thêm ảnh
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{ACCEPTED_LABEL}, tối đa 15 MB mỗi ảnh. Ảnh được tự nén trước khi tải lên.</p>
        {photoError && (
          <p role="alert" className="text-xs text-destructive">
            {photoError}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Chọn ảnh check-in"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </section>

      {/* Caption */}
      <section className="space-y-2">
        <Label htmlFor="checkin-caption">Bạn thấy nơi này thế nào?</Label>
        <Textarea
          id="checkin-caption"
          rows={3}
          maxLength={CAPTION_MAX}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={post.isPending}
        />
        <p className="text-right text-xs text-muted-foreground">
          {caption.length}/{CAPTION_MAX}
        </p>
      </section>

      {/* Feeling or activity */}
      <FeelingPicker ref={feelingPicker} value={feeling} onChange={setFeeling} disabled={post.isPending} />

      {/* Place */}
      <PlacePicker value={place} onChange={setPlace} searchInput={searchInput} disabled={post.isPending} />

      {post.isError && (
        <p role="alert" className="text-sm text-destructive">
          {(post.error as Error).message}
        </p>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={post.isPending}>
          Huỷ
        </Button>
        <Button type="submit" disabled={!hasContent || post.isPending}>
          {post.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {progress !== null && progress < 100 ? `Đang tải ảnh… ${progress}%` : 'Đăng check-in'}
        </Button>
      </DialogFooter>
      {!hasContent && (
        <p className="text-right text-xs text-muted-foreground">Thêm ảnh, cảm xúc hoặc vài dòng chia sẻ để đăng.</p>
      )}
    </form>
  )
}

const KIND_LABELS: Record<FeelingKind, string> = { feeling: 'Cảm xúc', activity: 'Hoạt động' }

/** Pick one feeling or activity; shown as "… đang cảm thấy thư giãn". */
function FeelingPicker({
  ref,
  value,
  onChange,
  disabled,
}: {
  ref: React.Ref<HTMLDivElement>
  value: string | null
  onChange: (key: string | null) => void
  disabled: boolean
}) {
  const [kind, setKind] = useState<FeelingKind>(feelingOption(value)?.kind ?? 'feeling')
  const chosen = feelingOption(value)

  return (
    <section ref={ref} className="space-y-2" aria-labelledby="checkin-feeling-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="checkin-feeling-heading" className="text-sm font-medium">
          Cảm xúc / Hoạt động
        </p>
        {chosen && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
            Bỏ chọn
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Loại" className="inline-flex rounded-full bg-muted p-1 text-xs font-semibold">
        {(Object.keys(KIND_LABELS) as FeelingKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'rounded-full px-3 py-1.5 transition-colors',
              kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {FEELING_OPTIONS.filter((f) => f.kind === kind).map((f) => {
          const selected = value === f.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? null : f.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                selected
                  ? 'border-foreground bg-sunset/15 font-semibold text-foreground'
                  : 'border-foreground/10 hover:border-foreground/30 hover:bg-muted',
              )}
            >
              <span aria-hidden className="text-lg leading-none">
                {f.emoji}
              </span>
              {f.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PlacePicker({
  value,
  onChange,
  searchInput,
  disabled,
}: {
  value: Place | null
  onChange: (place: Place | null) => void
  searchInput: React.RefObject<HTMLInputElement | null>
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search as the user types, after a short pause; drop answers to older queries.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchPlaces(q, controller.signal)
        .then((places) => {
          setResults(places)
          setError(null)
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setError((e as Error).message)
        })
        .finally(() => setSearching(false))
    }, 450)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  // Results for a query that is now too short are stale: don't show them.
  const shown = query.trim().length >= 2 ? results : []

  async function useMyLocation() {
    setLocating(true)
    setError(null)
    try {
      const { lat, lng } = await getDevicePosition()
      const named = await placeAt(lat, lng).catch(() => null)
      onChange(named ?? { name: 'Vị trí hiện tại', address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  if (value) {
    return (
      <section className="space-y-2">
        <p className="text-sm font-medium">Địa điểm</p>
        <div className="flex items-start gap-3 rounded-2xl bg-muted p-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-orange-500" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{value.name}</p>
            {value.address && <p className="text-xs text-muted-foreground">{value.address}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
            Đổi
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Địa điểm</p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={useMyLocation} disabled={disabled || locating}>
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
          Dùng vị trí hiện tại
        </Button>
      </div>

      {canSearchPlaces && (
        <div className="space-y-1.5">
          <Label htmlFor="checkin-place-search" className="text-xs">
            Hoặc tìm theo tên địa điểm
          </Label>
          <div className="relative">
            <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInput}
              id="checkin-place-search"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              role="combobox"
              aria-expanded={shown.length > 0}
              aria-controls="checkin-place-results"
            />
            {searching && (
              <Loader2 aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {shown.length > 0 && (
            <ul id="checkin-place-results" role="listbox" className="max-h-56 overflow-y-auto rounded-2xl border border-foreground/10">
              {shown.map((place, i) => (
                <li key={`${place.lng},${place.lat},${i}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(place)
                      // Your Activity → Search History: the search that found a place.
                      activityService.recordSearch('place', query)
                      setQuery('')
                      setResults([])
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted',
                      i > 0 && 'border-t border-foreground/5',
                    )}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-orange-500" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-medium">{place.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{place.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !searching && shown.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">Không tìm thấy địa điểm phù hợp.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Không bắt buộc. Check-in vẫn đăng được khi không có địa điểm.</p>
    </section>
  )
}
