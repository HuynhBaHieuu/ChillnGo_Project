import { Loader2, MapPin } from 'lucide-react'
import { Suspense, lazy, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { t } from '@/i18n'
import { placeAt } from '@/lib/geo'
import type { ResolvedPlace } from '@/lib/mapsLink'

const LocationPickerMap = lazy(() => import('@/features/map/LocationPickerMap'))

interface MapPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the pin starts: the stop's current position, if it has one. */
  initial: { lat: number; lng: number } | null
  onPick: (place: ResolvedPlace) => void
}

/** Choose a stop's position by clicking the map; its address is looked up on confirm. */
export function MapPickerDialog({ open, onOpenChange, initial, onPick }: MapPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {/* Mounted only while open, so each opening starts from the stop's current pin. */}
        {open && <PickerBody initial={initial} onPick={onPick} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({
  initial,
  onPick,
  onCancel,
}: {
  initial: { lat: number; lng: number } | null
  onPick: (place: ResolvedPlace) => void
  onCancel: () => void
}) {
  const [position, setPosition] = useState(initial)
  const [confirming, setConfirming] = useState(false)

  async function confirm() {
    if (!position) return
    setConfirming(true)
    const place = await placeAt(position.lat, position.lng).catch(() => null)
    setConfirming(false)
    onPick({
      ...position,
      address: place
        ? [place.name, place.address].filter(Boolean).join(', ')
        : `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
      name: place?.name,
      types: place?.types,
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('Chọn vị trí trên bản đồ')}</DialogTitle>
        <DialogDescription>{t('Bấm vào bản đồ để thả ghim, kéo ghim để chỉnh cho đúng chỗ.')}</DialogDescription>
      </DialogHeader>

      <div className="np-media relative h-[min(60vh,28rem)] overflow-hidden rounded-xl">
        <Suspense
          fallback={
            <div className="grid size-full place-items-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </div>
          }
        >
          <LocationPickerMap value={position} onChange={setPosition} />
        </Suspense>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : t('Chưa chọn vị trí')}
      </p>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
          {t('Huỷ')}
        </Button>
        <Button onClick={() => void confirm()} disabled={!position || confirming}>
          {confirming && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t('Dùng vị trí này')}
        </Button>
      </DialogFooter>
    </>
  )
}
