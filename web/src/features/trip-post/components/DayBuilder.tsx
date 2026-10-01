import { Car, ImagePlus, Loader2, Plane, Plus, Ship, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AddressField } from '@/features/trip-post/components/AddressField'
import { PlaceField } from '@/features/trip-post/components/PlaceField'
import { UNPINNED, dayCostOf } from '@/lib/itinerary'
import { formatVnd } from '@/lib/format'
import { ACCEPTED_LABEL, ACCEPT_ATTRIBUTE, checkImageFile } from '@/lib/images'
import { cn } from '@/lib/utils'
import { postService } from '@/services'
import type { TravelMode, TripDay, TripLocation } from '@/services/types'

interface DayBuilderProps {
  day: TripDay
  index: number
  canRemove: boolean
  onChange: (day: TripDay) => void
  onRemove: () => void
}

/** Stop photos show at most ~800px wide; 1600 keeps them sharp on retina. */
const STOP_PHOTO_MAX_SIDE = 1600

export function DayBuilder({ day, index, canRemove, onChange, onRemove }: DayBuilderProps) {
  function patchDay(patch: Partial<TripDay>) {
    onChange({ ...day, ...patch })
  }

  function patchLocation(locationId: string, patch: Partial<TripLocation>) {
    patchDay({
      locations: day.locations.map((loc) =>
        loc._id === locationId ? { ...loc, ...patch } : loc,
      ),
    })
  }

  function addLocation() {
    const newLocation: TripLocation = {
      _id: `${day._id}_l${day.locations.length + 1}_${Date.now().toString(36)}`,
      name: '',
      address: '',
      note: '',
      estCost: 0,
      photoUrl: null,
      // Not on the map until the author picks a place (PlaceField).
      ...UNPINNED,
    }
    patchDay({ locations: [...day.locations, newLocation] })
  }

  function removeLocation(locationId: string) {
    patchDay({ locations: day.locations.filter((loc) => loc._id !== locationId) })
  }

  return (
    <GlassCard className="p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-2">
              <Label htmlFor={`${day._id}-title`}>Tiêu đề ngày {index + 1}</Label>
              <Input
                id={`${day._id}-title`}
                value={day.title}
                onChange={(e) => patchDay({ title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${day._id}-date`}>Ngày</Label>
              <Input
                id={`${day._id}-date`}
                type="date"
                value={day.date}
                onChange={(e) => patchDay({ date: e.target.value })}
              />
            </div>
          </div>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Xoá ngày ${index + 1}`}
            className="mt-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        )}
      </header>

      {/* Locations */}
      <div className="mt-6 space-y-4">
        {day.locations.map((location, locIndex) => (
          <LocationRow
            key={location._id}
            location={location}
            index={locIndex}
            canRemove={day.locations.length > 1}
            onChange={(patch) => patchLocation(location._id, patch)}
            onRemove={() => removeLocation(location._id)}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addLocation}>
          <Plus />
          Thêm điểm dừng
        </Button>
        <p className="text-sm text-muted-foreground">
          Ngày này: <span className="text-foreground">{formatVnd(dayCostOf(day))}</span>
        </p>
      </div>
    </GlassCard>
  )
}

function LocationRow({
  location,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  location: TripLocation
  index: number
  canRemove: boolean
  onChange: (patch: Partial<TripLocation>) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  /** Upload progress 0–100 while a photo is being sent; null otherwise. */
  const [uploading, setUploading] = useState<number | null>(null)

  async function uploadPhoto(file: File) {
    const problem = checkImageFile(file)
    setPhotoError(problem)
    if (problem) return
    setUploading(0)
    try {
      onChange({ photoUrl: await postService.uploadJourneyImage(file, setUploading, STOP_PHOTO_MAX_SIDE) })
    } catch (error) {
      setPhotoError((error as Error).message)
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-start gap-4">
        <span className="mt-7 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          {/* The day's first stop is where it starts: there is no leg to it. */}
          {index > 0 && (
            <TravelModePicker
              value={location.travelMode ?? 'road'}
              stopNumber={index + 1}
              onChange={(travelMode) => onChange({ travelMode })}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor={`${location._id}-name`} className="text-xs">
                Tên địa điểm
              </Label>
              <PlaceField
                id={`${location._id}-name`}
                label={`Tên địa điểm ${index + 1}`}
                location={location}
                onChange={onChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${location._id}-cost`} className="text-xs">
                Chi phí (₫)
              </Label>
              <Input
                id={`${location._id}-cost`}
                type="number"
                min={0}
                step={1000}
                value={location.estCost}
                onChange={(e) => onChange({ estCost: Number(e.target.value) || 0 })}
                aria-label={`Chi phí ước tính cho địa điểm ${index + 1}`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${location._id}-address`} className="text-xs">
              Địa chỉ
            </Label>
            <AddressField
              id={`${location._id}-address`}
              label={`Địa chỉ của địa điểm ${index + 1}`}
              location={location}
              onChange={onChange}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${location._id}-note`} className="text-xs">
              Ghi chú
            </Label>
            <Textarea
              id={`${location._id}-note`}
              value={location.note}
              onChange={(e) => onChange({ note: e.target.value })}
              rows={2}
              aria-label={`Ghi chú cho địa điểm ${index + 1}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(location.photoUrl || uploading !== null) && (
              <a
                href={location.photoUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-label="Xem ảnh cỡ lớn"
                className="np-media relative block size-16 shrink-0 overflow-hidden rounded-xl bg-np-well"
              >
                {location.photoUrl && (
                  <img src={location.photoUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                )}
                {uploading !== null && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-np-canopy/70 text-[11px] font-semibold text-np-cream">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {uploading}%
                  </span>
                )}
              </a>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void uploadPhoto(file)
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus />
              {uploading !== null ? 'Đang tải ảnh…' : location.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh'}
            </Button>

            {location.photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading !== null}
                onClick={() => onChange({ photoUrl: null })}
                className="text-muted-foreground"
              >
                Bỏ ảnh
              </Button>
            )}

            <span className="text-xs text-muted-foreground">
              {ACCEPTED_LABEL}, tối đa 15 MB. Ảnh được tự nén rồi tải lên.
            </span>
            {photoError && (
              <span role="alert" className="w-full text-xs text-destructive">
                {photoError}
              </span>
            )}
          </div>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Xoá địa điểm ${index + 1}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  )
}

const TRAVEL_MODES: { mode: TravelMode; label: string; Icon: typeof Car }[] = [
  { mode: 'road', label: 'Đường bộ', Icon: Car },
  { mode: 'flight', label: 'Máy bay', Icon: Plane },
  { mode: 'water', label: 'Tàu, phà, ca nô', Icon: Ship },
]

/** How the traveller got from the previous stop to this one; sets how the map draws the leg. */
function TravelModePicker({
  value,
  stopNumber,
  onChange,
}: {
  value: TravelMode
  stopNumber: number
  onChange: (mode: TravelMode) => void
}) {
  return (
    <div role="group" aria-label={`Phương tiện đến địa điểm ${stopNumber}`} className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Đến đây bằng</span>
      {TRAVEL_MODES.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === mode
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
