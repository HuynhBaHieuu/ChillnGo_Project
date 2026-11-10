import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/i18n'
import { catalogService } from '@/services'
import type { CatalogMeta, Destination, Place, PlaceInput } from '@/services/catalog.service'

import { Pagination } from '../shared'
import type { Notice } from '../shared'
import { categoryLabel, formatVnd, numberText, parseAmount, parseNumber, tagLabel } from './catalogFormat'
import { ChipPicker, EmptyRow, FormError, Loading, RowActions, TagList } from './catalogShared'

const ALL = 'all'
const NONE = 'none'

type TriState = 'unknown' | 'yes' | 'no'
const triOf = (value: boolean | null): TriState => (value === null ? 'unknown' : value ? 'yes' : 'no')
const boolOf = (value: TriState): boolean | null => (value === 'unknown' ? null : value === 'yes')

/** Địa điểm: the only places AI clone may put in an itinerary. */
export function PlacesTab({
  meta,
  destinations,
  onNotice,
}: {
  meta: CatalogMeta
  destinations: Destination[]
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [destinationId, setDestinationId] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Place | 'new' | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const params = {
    q: q || undefined,
    destinationId: destinationId === ALL ? undefined : destinationId,
    category: category === ALL ? undefined : category,
    page,
  }
  const list = useQuery({
    queryKey: ['admin', 'catalog', 'places', params],
    queryFn: () => catalogService.listPlaces(params),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (p: Place) => catalogService.deletePlace(p._id),
    onSuccess: (_data, p) => {
      onNotice({ kind: 'success', text: t('Đã xoá địa điểm {name}.', { name: p.name }) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  const destinationName = (id: string) => destinations.find((d) => d._id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('Tìm địa điểm')} className="pl-9" />
        </div>
        <Select
          value={destinationId}
          onValueChange={(v) => {
            setDestinationId(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="lg:w-48" aria-label={t('Lọc theo điểm đến')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('Mọi điểm đến')}</SelectItem>
            {destinations.map((d) => (
              <SelectItem key={d._id} value={d._id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="lg:w-48" aria-label={t('Lọc theo loại')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('Mọi loại')}</SelectItem>
            {meta.categories.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {categoryLabel(meta, c.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing('new')} disabled={destinations.length === 0} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          {t('Thêm địa điểm')}
        </Button>
      </div>
      {destinations.length === 0 && <p className="text-xs text-muted-foreground">{t('Hãy thêm một điểm đến trước khi thêm địa điểm.')}</p>}

      {list.isPending ? (
        <Loading text={t('Đang tải danh sách…')} />
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : list.data.items.length === 0 ? (
        <EmptyRow text={t('Không có địa điểm nào khớp bộ lọc.')} />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('Địa điểm')}</th>
                  <th className="px-4 py-3 font-medium">{t('Loại')}</th>
                  <th className="px-4 py-3 font-medium">{t('Chi phí / người')}</th>
                  <th className="px-4 py-3 font-medium">{t('Giờ mở cửa')}</th>
                  <th className="px-4 py-3 font-medium">{t('Tag')}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('Thao tác')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p._id} className="border-b border-foreground/5 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {destinationName(p.destinationId)}
                        {p.address && ` · ${p.address}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">{categoryLabel(meta, p.category)}</td>
                    <td className="px-4 py-3">{formatVnd(p.avgCost)}</td>
                    <td className="px-4 py-3">{p.openingHours ? `${p.openingHours.open}–${p.openingHours.close}` : t('Chưa rõ')}</td>
                    <td className="px-4 py-3">
                      <TagList tags={p.tags} meta={meta} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        name={p.name}
                        onEdit={() => setEditing(p)}
                        onDelete={() => remove.mutateAsync(p).catch(() => undefined)}
                        deleting={remove.isPending}
                        deleteDescription={t('Địa điểm sẽ bị xoá hẳn và AI không gợi ý nó nữa. Nếu có hành trình đang dùng địa điểm này, hệ thống sẽ từ chối xoá.')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{t('{n} địa điểm', { n: list.data.total })}</p>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        </>
      )}

      {editing && (
        <PlaceDialog
          place={editing === 'new' ? null : editing}
          defaultDestinationId={destinationId === ALL ? (destinations[0]?._id ?? '') : destinationId}
          meta={meta}
          destinations={destinations}
          onClose={() => setEditing(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  )
}

function PlaceDialog({
  place,
  defaultDestinationId,
  meta,
  destinations,
  onClose,
  onNotice,
}: {
  place: Place | null
  defaultDestinationId: string
  meta: CatalogMeta
  destinations: Destination[]
  onClose: () => void
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [destinationId, setDestinationId] = useState(place?.destinationId ?? defaultDestinationId)
  const [name, setName] = useState(place?.name ?? '')
  const [address, setAddress] = useState(place?.address ?? '')
  const [lat, setLat] = useState(numberText(place?.lat))
  const [lng, setLng] = useState(numberText(place?.lng))
  const [category, setCategory] = useState(place?.category ?? NONE)
  const [avgCost, setAvgCost] = useState(numberText(place?.avgCost))
  const [priceLevel, setPriceLevel] = useState(place?.priceLevel ? String(place.priceLevel) : NONE)
  const [open, setOpen] = useState(place?.openingHours?.open ?? '')
  const [close, setClose] = useState(place?.openingHours?.close ?? '')
  const [isOutdoor, setIsOutdoor] = useState<TriState>(triOf(place?.isOutdoor ?? null))
  const [requiresBooking, setRequiresBooking] = useState<TriState>(triOf(place?.requiresBooking ?? null))
  const [rating, setRating] = useState(numberText(place?.rating))
  const [photoUrl, setPhotoUrl] = useState(place?.photoUrl ?? '')
  const [tags, setTags] = useState<string[]>(place?.tags ?? [])
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: PlaceInput) => catalogService.savePlace(place?._id ?? null, input),
    onSuccess: ({ place: saved }) => {
      onNotice({ kind: 'success', text: t('Đã lưu địa điểm {name}.', { name: saved.name }) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
      onClose()
    },
    onError: (error) => setFormError((error as Error).message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const numbers = { lat: parseNumber(lat), lng: parseNumber(lng), avgCost: parseAmount(avgCost), rating: parseNumber(rating) }
    if (Object.values(numbers).some((n) => Number.isNaN(n))) {
      setFormError(t('Toạ độ, chi phí và điểm đánh giá phải là số, hoặc để trống.'))
      return
    }
    if (Boolean(open) !== Boolean(close)) {
      setFormError(t('Nhập cả giờ mở và giờ đóng cửa, hoặc để trống cả hai.'))
      return
    }
    setFormError(null)
    save.mutate({
      destinationId,
      name,
      address,
      ...numbers,
      category: category === NONE ? null : category,
      priceLevel: priceLevel === NONE ? null : Number(priceLevel),
      openingHours: open && close ? { open, close } : null,
      isOutdoor: boolOf(isOutdoor),
      requiresBooking: boolOf(requiresBooking),
      photoUrl: photoUrl.trim() || null,
      tags,
    })
  }

  const triSelect = (id: string, value: TriState, onChange: (v: TriState) => void) => (
    <Select value={value} onValueChange={(v) => onChange(v as TriState)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unknown">{t('Chưa rõ')}</SelectItem>
        <SelectItem value="yes">{t('Có')}</SelectItem>
        <SelectItem value="no">{t('Không')}</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{place ? t('Sửa địa điểm') : t('Thêm địa điểm')}</DialogTitle>
          <DialogDescription>
            {t('Chỉ nhập những gì đã kiểm chứng. Ô để trống hiển thị là “chưa có dữ liệu”, AI không tự ước lượng.')}
          </DialogDescription>
        </DialogHeader>

        <form id="place-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-destination">{t('Điểm đến')}</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="place-destination">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-category">{t('Loại')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="place-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('Chưa rõ')}</SelectItem>
                  {meta.categories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {categoryLabel(meta, c.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-name">{t('Tên địa điểm')}</Label>
            <Input id="place-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-address">{t('Địa chỉ')}</Label>
            <Input id="place-address" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-lat">{t('Vĩ độ')}</Label>
              <Input id="place-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-lng">{t('Kinh độ')}</Label>
              <Input id="place-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="place-cost">{t('Chi phí / người (VND)')}</Label>
              <Input id="place-cost" inputMode="numeric" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-price">{t('Mức giá')}</Label>
              <Select value={priceLevel} onValueChange={setPriceLevel}>
                <SelectTrigger id="place-price">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('Chưa rõ')}</SelectItem>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {'₫'.repeat(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-rating">{t('Đánh giá (0–5)')}</Label>
              <Input id="place-rating" inputMode="decimal" value={rating} onChange={(e) => setRating(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-open">{t('Giờ mở cửa')}</Label>
              <Input id="place-open" type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-close">{t('Giờ đóng cửa')}</Label>
              <Input id="place-close" type="time" value={close} onChange={(e) => setClose(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-outdoor">{t('Ngoài trời')}</Label>
              {triSelect('place-outdoor', isOutdoor, setIsOutdoor)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-booking">{t('Cần đặt trước')}</Label>
              {triSelect('place-booking', requiresBooking, setRequiresBooking)}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-photo">{t('Ảnh (đường dẫn)')}</Label>
            <Input id="place-photo" type="url" maxLength={500} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <ChipPicker
            legend={t('Tag cho checklist chuẩn bị')}
            options={meta.placeTags}
            value={tags}
            onChange={setTags}
            label={(tag) => tagLabel(meta, tag)}
          />
          <FormError message={formError} />
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('Huỷ')}
          </Button>
          <Button type="submit" form="place-form" disabled={save.isPending || !destinationId}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('Lưu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
