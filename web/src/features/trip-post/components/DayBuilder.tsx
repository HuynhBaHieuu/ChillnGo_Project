import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { dayCostOf } from '@/lib/itinerary'
import { formatVnd } from '@/lib/format'
import { ACCEPTED_LABEL, ACCEPT_ATTRIBUTE, checkImageFile } from '@/lib/images'
import { themeFromText, travelPhoto } from '@/lib/photos'
import type { TripDay, TripLocation } from '@/services/types'

interface DayBuilderProps {
  day: TripDay
  index: number
  canRemove: boolean
  onChange: (day: TripDay) => void
  onRemove: () => void
}

/**
 * Placeholder for image upload.
 *
 * Real uploads are out of scope this week. Picking a file gives a deterministic
 * stand-in URL derived from the file name, so the payload carries a plausible
 * string and the thumbnail renders — no bytes leave the browser.
 */
function placeholderUrlFor(fileName: string): string {
  const seed = fileName.replace(/\.[^.]+$/, '').slice(0, 40) || 'upload'
  return travelPhoto(seed, { theme: themeFromText(seed) })
}

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
      note: '',
      estCost: 0,
      photoUrl: null,
      // Centre of Vietnam — a neutral default until a real place picker exists.
      lng: 106.0,
      lat: 16.0,
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

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-start gap-4">
        <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px]">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <Input
              value={location.name}
              onChange={(e) => onChange({ name: e.target.value })}
              aria-label={`Tên địa điểm ${index + 1}`}
            />
            <Input
              type="number"
              min={0}
              step={1000}
              value={location.estCost}
              onChange={(e) => onChange({ estCost: Number(e.target.value) || 0 })}
              aria-label={`Chi phí ước tính cho địa điểm ${index + 1}`}
            />
          </div>

          <Textarea
            value={location.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={2}
            aria-label={`Ghi chú cho địa điểm ${index + 1}`}
          />

          <div className="flex flex-wrap items-center gap-3">
            {location.photoUrl && (
              <img
                src={location.photoUrl}
                alt=""
                className="size-12 rounded-2xl object-cover"
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const problem = checkImageFile(file)
                setPhotoError(problem)
                if (!problem) onChange({ photoUrl: placeholderUrlFor(file.name) })
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus />
              {location.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh'}
            </Button>

            {location.photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ photoUrl: null })}
                className="text-muted-foreground"
              >
                Bỏ ảnh
              </Button>
            )}

            <span className="text-xs text-muted-foreground">
              {ACCEPTED_LABEL}, tối đa 15 MB. Upload chưa được nối — ảnh chỉ là placeholder.
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
