import { ArrowLeft, Loader2, MapPinned, Plus, Save } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DayChip, DayMap, DayPills } from '@/features/itinerary-clone/components/DayMap'
import { dayColor } from '@/features/map/geometry'
import { useItinerary, useUpdateItinerary } from '@/features/itinerary-clone/hooks'
import { withLegRoutes } from '@/features/map/legs'
import { DayBuilder } from '@/features/trip-post/components/DayBuilder'
import { pinByName } from '@/features/trip-post/pinByName'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { translateServerMessage } from '@/i18n/server'
import { formatVnd } from '@/lib/format'
import { UNPINNED, totalCostOf } from '@/lib/itinerary'
import type { ClonedItinerary, ItineraryStatus, TripDay } from '@/services/types'

const STATUSES: ItineraryStatus[] = ['planning', 'confirmed', 'completed']

const STATUS_LABELS: Record<ItineraryStatus, MessageKey> = {
  planning: 'Đang lên kế hoạch',
  confirmed: 'Đã chốt',
  completed: 'Đã đi',
}

interface FormState {
  title: string
  note: string
  startDate: string
  status: ItineraryStatus
  days: TripDay[]
}

/** `start` plus `n` days, as YYYY-MM-DD. */
function addDays(start: string, n: number): string {
  const date = new Date(`${start}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

/** Days numbered and dated in order from the start date, as the API stores them. */
function redate(days: TripDay[], startDate: string): TripDay[] {
  return days.map((day, i) => ({ ...day, dayNumber: i + 1, date: addDays(startDate, i) }))
}

function emptyDay(itineraryId: string): TripDay {
  const id = `${itineraryId}_n${Date.now().toString(36)}`
  return {
    _id: id,
    dayNumber: 0,
    date: '',
    title: '',
    locations: [{ _id: `${id}_l1`, name: '', address: '', note: '', estCost: 0, photoUrl: null, ...UNPINNED }],
    photos: [],
  }
}

function stateFrom(itinerary: ClonedItinerary): FormState {
  return {
    title: itinerary.title,
    // The API writes the note in Vietnamese ("Sao chép từ hành trình …"); edit it as the reader sees it.
    note: translateServerMessage(itinerary.note),
    startDate: itinerary.startDate,
    status: itinerary.status,
    days: itinerary.days,
  }
}

/**
 * Editing a cloned itinerary: its name, note, start date and status, and every
 * day and stop, with the same day builder the journey editor uses. Only your
 * copy changes; the journey it came from stays as its author wrote it.
 */
export function ItineraryEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: itinerary, isPending, isError } = useItinerary(id)
  const update = useUpdateItinerary(id ?? '')
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState | null>(null)
  // Filled once when the itinerary arrives; a later refetch keeps in-progress edits.
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null)
  if (itinerary && hydratedFrom !== itinerary._id) {
    setHydratedFrom(itinerary._id)
    setForm(stateFrom(itinerary))
  }

  const [pinning, setPinning] = useState(false)
  // The day the map beside the list is framed on; null shows the whole trip.
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const totalEstCost = useMemo(() => (form ? totalCostOf(form.days) : 0), [form])

  if (isPending || (itinerary && !form)) {
    return (
      <PageContainer wide>
        <Skeleton className="h-12 w-80" />
        <div className="mt-10 space-y-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (isError || !itinerary || !form) {
    return (
      <PageContainer wide>
        <EmptyState
          title={t('Không tìm thấy lịch trình')}
          description={t('Lịch trình này có thể đã bị xoá.')}
          action={
            <Button asChild variant="outline">
              <Link to="/itineraries?tab=cloned">{t('Về danh sách')}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const busy = update.isPending || pinning
  // A day can be deleted while focused.
  const focus = focusDay !== null && focusDay < form.days.length ? focusDay : null

  /** Frames the map on a day and, when asked, scrolls the list to it (a stop tapped on the map). */
  function showDay(index: number | null, scroll = false) {
    setFocusDay(index)
    if (scroll && index !== null) {
      const id = form?.days[index]?._id
      const el = id ? sectionRefs.current.get(id) : undefined
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  const backTo = `/itineraries/${itinerary._id}`

  function patch(change: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...change } : current))
  }

  function setDays(change: (days: TripDay[]) => TripDay[]) {
    setForm((current) => (current ? { ...current, days: redate(change(current.days), current.startDate) } : current))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setPinning(true)
    const days = await pinByName(form.days)
      .then(withLegRoutes)
      .finally(() => setPinning(false))
    if (days !== form.days) patch({ days })
    update.mutate(
      { title: form.title.trim(), note: form.note.trim(), startDate: form.startDate, status: form.status, days },
      { onSuccess: () => void navigate(backTo) },
    )
  }

  return (
    <PageContainer wide>
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {itinerary.title}
      </Link>

      <PageHeader
        title={t('Chỉnh sửa lịch trình')}
        description={t('Sửa lịch trình theo cách bạn muốn đi: đổi tên, ngày khởi hành, thêm bớt ngày và điểm dừng. Hành trình gốc không bị thay đổi.')}
      />

      <form
        onSubmit={(e) => void submit(e)}
        className="animate-fade-rise-delay grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:items-start"
      >
        <div className="min-w-0 space-y-8">
          <GlassCard className="space-y-5 p-6">
            <h2 className="font-display text-2xl">{t('Thông tin chung')}</h2>

            <div className="space-y-2">
              <Label htmlFor="itinerary-title">{t('Tên lịch trình')}</Label>
              <Input
                id="itinerary-title"
                required
                maxLength={150}
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itinerary-note">{t('Ghi chú')}</Label>
              <Textarea
                id="itinerary-note"
                rows={3}
                maxLength={1000}
                value={form.note}
                onChange={(e) => patch({ note: e.target.value })}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="itinerary-start">{t('Ngày khởi hành')}</Label>
                <Input
                  id="itinerary-start"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value
                    if (!startDate) return
                    setForm((current) =>
                      current ? { ...current, startDate, days: redate(current.days, startDate) } : current,
                    )
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('Các ngày trong lịch trình sẽ được đánh lại từ ngày này.')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('Trạng thái')}</Label>
                <Select value={form.status} onValueChange={(value) => patch({ status: value as ItineraryStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(STATUS_LABELS[status])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>

          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">{t('Lịch trình ({n} ngày)', { n: form.days.length })}</h2>
            </div>

            <div className="sticky top-20 z-10 -mx-2 rounded-2xl bg-background/90 px-2 py-2 backdrop-blur">
              <DayPills days={form.days} value={focus} onChange={(i) => showDay(i, true)} />
            </div>

            {form.days.map((day, index) => {
              const focused = focus === index
              return (
                <div
                  key={day._id}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(day._id, el)
                    else sectionRefs.current.delete(day._id)
                  }}
                  // Working on a day (a click or a field) frames the map on it.
                  onFocusCapture={() => focus !== index && setFocusDay(index)}
                  onClick={() => focus !== index && setFocusDay(index)}
                  className="scroll-mt-36 space-y-2 rounded-[1.4rem] transition-shadow"
                  style={focused ? { boxShadow: `0 0 0 2px ${dayColor(index + 1)}` } : undefined}
                >
                  <div className="flex items-center gap-2 px-2 pt-2">
                    <DayChip index={index} />
                    <span className="truncate text-sm text-muted-foreground">{day.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFocusDay(focused ? null : index)
                      }}
                      aria-pressed={focused}
                      title={focused ? t('Hiện tất cả') : t('Chỉ hiện ngày này trên bản đồ')}
                      aria-label={focused ? t('Hiện tất cả') : t('Chỉ hiện ngày này trên bản đồ')}
                      className="ml-auto rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      style={focused ? { color: dayColor(index + 1), backgroundColor: `color-mix(in srgb, ${dayColor(index + 1)} 14%, transparent)` } : undefined}
                    >
                      <MapPinned className="size-4" />
                    </button>
                  </div>
                  <DayBuilder
                    day={day}
                    index={index}
                    canRemove={form.days.length > 1}
                    dateLocked
                    onChange={(updated) => setDays((days) => days.map((d) => (d._id === updated._id ? updated : d)))}
                    onRemove={() => {
                      setDays((days) => days.filter((d) => d._id !== day._id))
                      setFocusDay(null)
                    }}
                  />
                </div>
              )
            })}

            <button
              type="button"
              disabled={form.days.length >= 60}
              onClick={() => {
                const added = emptyDay(itinerary._id)
                setDays((days) => [...days, added])
                setFocusDay(form.days.length)
                window.setTimeout(() => sectionRefs.current.get(added._id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
            >
              <Plus className="size-4" />
              {t('Thêm ngày')}
            </button>
          </section>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <DayMap
            days={form.days}
            focus={focus}
            onFocus={(i) => showDay(i, true)}
            title={form.title}
            className="h-[45vh] lg:h-[calc(100dvh-17rem)]"
          />

          <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t('Tổng chi phí ước tính')}</p>
              <p className="mt-0.5 font-display text-2xl">{formatVnd(totalEstCost)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild type="button" variant="ghost">
                <Link to={backTo}>{t('Huỷ')}</Link>
              </Button>
              <GlassButton type="submit" size="lg" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Save />}
                {t('Lưu thay đổi')}
              </GlassButton>
            </div>
            {update.isError && (
              <p role="alert" className="w-full text-sm text-destructive">
                {translateServerMessage((update.error as Error).message)}
              </p>
            )}
          </GlassCard>
        </aside>
      </form>
    </PageContainer>
  )
}
