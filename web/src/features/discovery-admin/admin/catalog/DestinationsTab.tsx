import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { useState } from 'react'
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
import { t } from '@/i18n'
import { catalogService } from '@/services'
import type { Destination, DestinationInput } from '@/services/catalog.service'

import type { Notice } from '../shared'
import { numberText, parseNumber } from './catalogFormat'
import { ChipPicker, EmptyRow, FormError, RowActions } from './catalogShared'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

function months(list: number[]): string {
  return list.length ? list.join(', ') : '—'
}

/** Điểm đến: the areas AI clone draws places from, with their season facts. */
export function DestinationsTab({
  destinations,
  onNotice,
}: {
  destinations: Destination[]
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Destination | 'new' | null>(null)

  const remove = useMutation({
    mutationFn: (d: Destination) => catalogService.deleteDestination(d._id),
    onSuccess: (_data, d) => {
      onNotice({ kind: 'success', text: t('Đã xoá điểm đến {name}.', { name: d.name }) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('Mỗi điểm đến là một vùng có tâm và bán kính. AI chỉ gợi ý địa điểm nằm trong vùng đó, và chỉ nhắc mùa mưa, mùa cao điểm, lễ hội đã được nhập ở đây.')}
        </p>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          {t('Thêm điểm đến')}
        </Button>
      </div>

      {destinations.length === 0 ? (
        <EmptyRow text={t('Chưa có điểm đến nào.')} />
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('Điểm đến')}</th>
                <th className="px-4 py-3 font-medium">{t('Bán kính')}</th>
                <th className="px-4 py-3 font-medium">{t('Mùa mưa (tháng)')}</th>
                <th className="px-4 py-3 font-medium">{t('Cao điểm (tháng)')}</th>
                <th className="px-4 py-3 font-medium">{t('Địa điểm')}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t('Thao tác')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => (
                <tr key={d._id} className="border-b border-foreground/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.region} · {d.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">{d.radiusKm} km</td>
                  <td className="px-4 py-3">{months(d.rainyMonths)}</td>
                  <td className="px-4 py-3">{months(d.peakMonths)}</td>
                  <td className="px-4 py-3">{d.placeCount}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      name={d.name}
                      onEdit={() => setEditing(d)}
                      onDelete={() => remove.mutateAsync(d).catch(() => undefined)}
                      deleting={remove.isPending}
                      deleteDescription={
                        d.placeCount > 0
                          ? t('Điểm đến này còn {n} địa điểm nên chưa xoá được. Hãy xoá hoặc chuyển các địa điểm đó trước.', { n: d.placeCount })
                          : t('Điểm đến sẽ bị xoá hẳn. Không hoàn tác được.')
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <DestinationDialog
          destination={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  )
}

function DestinationDialog({
  destination,
  onClose,
  onNotice,
}: {
  destination: Destination | null
  onClose: () => void
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(destination?.name ?? '')
  const [slug, setSlug] = useState(destination?.slug ?? '')
  const [region, setRegion] = useState(destination?.region ?? '')
  const [lat, setLat] = useState(numberText(destination?.lat))
  const [lng, setLng] = useState(numberText(destination?.lng))
  const [radiusKm, setRadiusKm] = useState(numberText(destination?.radiusKm ?? 20))
  const [rainyMonths, setRainyMonths] = useState<number[]>(destination?.rainyMonths ?? [])
  const [peakMonths, setPeakMonths] = useState<number[]>(destination?.peakMonths ?? [])
  const [festivals, setFestivals] = useState(destination?.festivals ?? [])
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: DestinationInput) => catalogService.saveDestination(destination?._id ?? null, input),
    onSuccess: ({ destination: saved }) => {
      onNotice({ kind: 'success', text: t('Đã lưu điểm đến {name}.', { name: saved.name }) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
      onClose()
    },
    onError: (error) => setFormError((error as Error).message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const numbers = { lat: parseNumber(lat), lng: parseNumber(lng), radiusKm: parseNumber(radiusKm) }
    if (Object.values(numbers).some((n) => n === null || Number.isNaN(n))) {
      setFormError(t('Vĩ độ, kinh độ và bán kính phải là số.'))
      return
    }
    setFormError(null)
    save.mutate({
      name,
      slug,
      region,
      lat: numbers.lat!,
      lng: numbers.lng!,
      radiusKm: numbers.radiusKm!,
      rainyMonths,
      peakMonths,
      festivals: festivals.filter((f) => f.name.trim()),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>{destination ? t('Sửa điểm đến') : t('Thêm điểm đến')}</DialogTitle>
          <DialogDescription>{t('Để trống những gì chưa chắc chắn. AI không bao giờ tự đoán thời tiết hay lễ hội.')}</DialogDescription>
        </DialogHeader>

        <form id="destination-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dest-name">{t('Tên điểm đến')}</Label>
              <Input id="dest-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-slug">{t('Mã đường dẫn')}</Label>
              <Input
                id="dest-slug"
                required
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title={t('Chữ không dấu, số và dấu gạch ngang, ví dụ da-lat')}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dest-region">{t('Vùng / tỉnh')}</Label>
            <Input id="dest-region" required maxLength={80} value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dest-lat">{t('Vĩ độ tâm')}</Label>
              <Input id="dest-lat" required inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-lng">{t('Kinh độ tâm')}</Label>
              <Input id="dest-lng" required inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-radius">{t('Bán kính (km)')}</Label>
              <Input id="dest-radius" required inputMode="decimal" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
            </div>
          </div>

          <ChipPicker legend={t('Tháng mùa mưa')} options={MONTHS} value={rainyMonths} onChange={setRainyMonths} label={String} />
          <ChipPicker legend={t('Tháng cao điểm')} options={MONTHS} value={peakMonths} onChange={setPeakMonths} label={String} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('Lễ hội')}</legend>
            {festivals.map((festival, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={t('Tên lễ hội')}
                  maxLength={80}
                  value={festival.name}
                  onChange={(e) => setFestivals(festivals.map((f, j) => (j === i ? { ...f, name: e.target.value } : f)))}
                />
                <select
                  aria-label={t('Tháng')}
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={festival.month}
                  onChange={(e) => setFestivals(festivals.map((f, j) => (j === i ? { ...f, month: Number(e.target.value) } : f)))}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {t('Tháng {n}', { n: m })}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('Bỏ lễ hội này')}
                  onClick={() => setFestivals(festivals.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setFestivals([...festivals, { name: '', month: 1 }])}>
              <Plus className="size-4" aria-hidden />
              {t('Thêm lễ hội')}
            </Button>
          </fieldset>

          <FormError message={formError} />
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('Huỷ')}
          </Button>
          <Button type="submit" form="destination-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('Lưu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
