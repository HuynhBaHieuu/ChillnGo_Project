import { Loader2, MapPin } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { GlassButton } from '@/components/Button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MapPickerDialog } from '@/features/trip-post/components/MapPickerDialog'
import { t } from '@/i18n'
import type { Business, BusinessInput, BusinessType } from '@/services/types'

import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from './labels'
import { PhotoPicker } from './PhotoPicker'

export const MAX_BUSINESS_PHOTOS = 8

function initialInput(business: Business | null): BusinessInput {
  return {
    name: business?.name ?? '',
    type: business?.type ?? 'homestay',
    description: business?.description ?? '',
    address: business?.address ?? '',
    city: business?.city ?? '',
    lat: business?.lat ?? null,
    lng: business?.lng ?? null,
    phone: business?.phone ?? '',
    website: business?.website ?? '',
    photos: business?.photos ?? [],
    priceFrom: business?.priceFrom ?? null,
    priceTo: business?.priceTo ?? null,
    openingHours: business?.openingHours ?? '',
  }
}

const toPrice = (text: string): number | null => {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** Register or edit a business page. The API checks every field again. */
export function BusinessForm({
  business,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  business: Business | null
  submitLabel: string
  pending: boolean
  error: string | null
  onSubmit: (input: BusinessInput) => void
  onCancel?: () => void
}) {
  const [input, setInput] = useState<BusinessInput>(() => initialInput(business))
  const [mapOpen, setMapOpen] = useState(false)
  const set = <K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) => setInput((prev) => ({ ...prev, [key]: value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ ...input, website: input.website.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="b-name" label={t('Tên cơ sở')}>
          <Input id="b-name" required maxLength={80} value={input.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id="b-type" label={t('Loại hình')}>
          <Select value={input.type} onValueChange={(value) => set('type', value as BusinessType)}>
            <SelectTrigger id="b-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(BUSINESS_TYPE_LABELS[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id="b-address" label={t('Địa chỉ')}>
        <div className="flex gap-2">
          <Input id="b-address" required maxLength={200} value={input.address} onChange={(e) => set('address', e.target.value)} />
          <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
            <MapPin className="size-4" aria-hidden />
            {input.lat !== null ? t('Đổi vị trí') : t('Chọn trên bản đồ')}
          </Button>
        </div>
        {input.lat !== null && input.lng !== null && (
          <p className="text-xs text-muted-foreground">
            {t('Đã ghim vị trí: {lat}, {lng}', { lat: input.lat.toFixed(5), lng: input.lng.toFixed(5) })}
          </p>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="b-city" label={t('Tỉnh/thành')}>
          <Input id="b-city" maxLength={60} value={input.city} onChange={(e) => set('city', e.target.value)} placeholder="Đà Lạt" />
        </Field>
        <Field id="b-phone" label={t('Số điện thoại')}>
          <Input id="b-phone" required inputMode="tel" maxLength={15} value={input.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field id="b-from" label={t('Giá từ (VND)')}>
          <Input
            id="b-from"
            inputMode="numeric"
            value={input.priceFrom ?? ''}
            onChange={(e) => set('priceFrom', toPrice(e.target.value))}
          />
        </Field>
        <Field id="b-to" label={t('Giá đến (VND)')}>
          <Input id="b-to" inputMode="numeric" value={input.priceTo ?? ''} onChange={(e) => set('priceTo', toPrice(e.target.value))} />
        </Field>
        <Field id="b-hours" label={t('Giờ mở cửa')}>
          <Input
            id="b-hours"
            maxLength={100}
            value={input.openingHours}
            onChange={(e) => set('openingHours', e.target.value)}
            placeholder="07:00 – 22:00"
          />
        </Field>
        <Field id="b-web" label={t('Website hoặc fanpage')}>
          <Input id="b-web" type="url" maxLength={300} value={input.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        </Field>
      </div>

      <Field id="b-desc" label={t('Giới thiệu')}>
        <Textarea id="b-desc" rows={5} maxLength={2000} value={input.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <Field id="b-photos" label={t('Ảnh cơ sở')}>
        <PhotoPicker value={input.photos} onChange={(photos) => set('photos', photos)} max={MAX_BUSINESS_PHOTOS} />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <GlassButton type="submit" tone="sunset" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </GlassButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('Huỷ')}
          </Button>
        )}
      </div>

      <MapPickerDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        initial={input.lat !== null && input.lng !== null ? { lat: input.lat, lng: input.lng } : null}
        onPick={(place) => {
          setInput((prev) => ({ ...prev, lat: place.lat, lng: place.lng, address: prev.address || place.address }))
          setMapOpen(false)
        }}
      />
    </form>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
