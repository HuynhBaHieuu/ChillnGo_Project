import { Loader2, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { MapPreview } from '@/components/MapPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CoverPicker } from '@/features/trip-post/components/CoverPicker'
import { DayBuilder } from '@/features/trip-post/components/DayBuilder'
import { TagPicker } from '@/features/trip-post/components/TagPicker'
import { useCreatePost, usePost, useUpdatePost } from '@/features/trip-post/hooks'
import {
  BUDGET_LABELS,
  BUDGET_LEVELS,
  REGIONS,
  REGION_LABELS,
  SEASONS,
  SEASON_LABELS,
  formatVnd,
} from '@/lib/format'
import { searchPlaces } from '@/lib/geo'
import { UNPINNED, isPinned, totalCostOf } from '@/lib/itinerary'
import { themeFromText, travelCover } from '@/lib/photos'
import type {
  BudgetLevel,
  Region,
  RouteGeoJson,
  Season,
  TripDay,
  TripPostPayload,
  TripPostWithAuthor,
} from '@/services/types'
import { useAuthStore } from '@/store'

/** Everything the form edits, before it is shaped into a `TripPostPayload`. */
interface FormState {
  title: string
  summary: string
  coverUrl: string
  region: Region
  season: Season
  budgetLevel: BudgetLevel
  tags: string[]
  days: TripDay[]
}

function emptyDay(index: number, startDate: string): TripDay {
  const date = new Date(`${startDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + index)

  const id = `draft_d${index + 1}_${Date.now().toString(36)}`
  return {
    _id: id,
    dayNumber: index + 1,
    date: date.toISOString().slice(0, 10),
    title: '',
    locations: [
      {
        _id: `${id}_l1`,
        name: '',
        address: '',
        note: '',
        estCost: 0,
        photoUrl: null,
        ...UNPINNED,
      },
    ],
    photos: [],
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function initialState(): FormState {
  const start = todayIso()
  return {
    title: '',
    summary: '',
    coverUrl: '',
    region: 'north',
    season: 'autumn',
    budgetLevel: 'medium',
    tags: [],
    days: [emptyDay(0, start)],
  }
}

function stateFromPost(post: TripPostWithAuthor): FormState {
  return {
    title: post.title,
    summary: post.summary,
    coverUrl: post.coverUrl,
    region: post.region,
    season: post.season,
    budgetLevel: post.budgetLevel,
    tags: post.tags,
    days: post.days,
  }
}

/**
 * The route geometry is derived from the stops the author entered, in order.
 *
 * No Directions API call — the "route" is a straight polyline, which is exactly
 * what the fixtures encode and what `MapPreview` draws.
 */
function buildRouteGeoJson(days: TripDay[], title: string): RouteGeoJson {
  // Only stops with a real position: the unpinned placeholder is not a place.
  const coordinates = days.flatMap((day) =>
    day.locations.filter(isPinned).map((loc): [number, number] => [loc.lng, loc.lat]),
  )

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { title, dayCount: days.length },
      },
    ],
  }
}

export function PostEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data: existingPost, isPending: isLoadingPost } = usePost(id)
  const [form, setForm] = useState<FormState>(initialState)

  /**
   * Fill the form once the post being edited arrives.
   *
   * Done during render rather than in an effect — React's own pattern for
   * deriving state from changing data — so the form never paints empty for a
   * frame before the fetched post lands. Keyed on the post id so a later
   * refetch does not discard the author's in-progress edits.
   */
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null)
  if (isEdit && existingPost && hydratedFrom !== existingPost._id) {
    setHydratedFrom(existingPost._id)
    setForm(stateFromPost(existingPost))
  }

  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  /**
   * /posts/new?focus=… — the Newsfeed composer's shortcuts land on a specific
   * field: cover (Ảnh), days (Lịch trình), place (Địa điểm). Default: title.
   * Runs once when the page opens; later edits never move the cursor.
   */
  const [searchParams] = useSearchParams()
  const focusTarget = isEdit ? null : (searchParams.get('focus') ?? 'title')
  useEffect(() => {
    if (!focusTarget) return
    const selector: Record<string, string> = {
      title: '#title',
      cover: '#coverUrl',
      days: '[data-editor-days] input[id$="-title"]',
      place: '[data-editor-days] input[aria-label="Tên địa điểm 1"]',
    }
    const timer = window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>(selector[focusTarget] ?? '#title')
      if (!field) return
      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(timer)
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createPost = useCreatePost()
  const updatePost = useUpdatePost(id ?? '')
  const mutation = isEdit ? updatePost : createPost

  const totalEstCost = useMemo(() => totalCostOf(form.days), [form.days])

  // Live route preview: the same geometry the saved journey will carry.
  const routePreview = useMemo(() => buildRouteGeoJson(form.days, form.title), [form.days, form.title])
  const totalStops = form.days.reduce((n, d) => n + d.locations.length, 0)
  const pinnedStops = form.days.reduce((n, d) => n + d.locations.filter(isPinned).length, 0)

  // The cover a post gets when none is chosen; also the picker's preview.
  const autoCover = useMemo(
    () => travelCover(form.title.slice(0, 30) || 'chillngo', themeFromText(form.title)),
    [form.title],
  )

  function patch(update: Partial<FormState>) {
    setForm((current) => ({ ...current, ...update }))
  }

  function addDay() {
    setForm((current) => {
      const start = current.days[0]?.date ?? todayIso()
      return { ...current, days: [...current.days, emptyDay(current.days.length, start)] }
    })
  }

  function removeDay(dayId: string) {
    setForm((current) => ({
      ...current,
      days: current.days
        .filter((d) => d._id !== dayId)
        .map((d, i) => ({ ...d, dayNumber: i + 1 })),
    }))
  }

  function updateDay(updated: TripDay) {
    setForm((current) => ({
      ...current,
      days: current.days.map((d) => (d._id === updated._id ? updated : d)),
    }))
  }

  function buildPayload(status: 'draft' | 'published', source: TripDay[] = form.days): TripPostPayload {
    const sorted = [...source].sort((a, b) => a.date.localeCompare(b.date))
    const days = source.map((day, i) => ({ ...day, dayNumber: i + 1 }))

    return {
      authorId: user?._id ?? '',
      title: form.title.trim(),
      summary: form.summary.trim(),
      coverUrl: form.coverUrl.trim() || autoCover,
      region: form.region,
      season: form.season,
      startDate: sorted[0]?.date ?? todayIso(),
      endDate: sorted[sorted.length - 1]?.date ?? todayIso(),
      days,
      tags: form.tags,
      budgetLevel: form.budgetLevel,
      totalEstCost,
      routeGeoJson: buildRouteGeoJson(days, form.title),
      status,
    }
  }

  /** True while unpinned stops are being looked up by name, before saving. */
  const [pinning, setPinning] = useState(false)

  /**
   * Stops the author described but never pinned get the first place Mapbox
   * finds for their address (or, without one, their name), so a typed address
   * still lands on the map. What they typed is kept. Stops nothing is found
   * for stay off the map.
   */
  async function pinByName(days: TripDay[]): Promise<TripDay[]> {
    const queryOf = (l: TripDay['locations'][number]) => (l.address?.trim() || l.name).trim()
    const todo = days.flatMap((d) => d.locations).filter((l) => !isPinned(l) && queryOf(l).length >= 2)
    if (todo.length === 0) return days
    const found = new Map<string, { lng: number; lat: number }>()
    await Promise.all(
      todo.map(async (loc) => {
        const [place] = await searchPlaces(queryOf(loc)).catch(() => [])
        if (place) found.set(loc._id, { lng: place.lng, lat: place.lat })
      }),
    )
    if (found.size === 0) return days
    return days.map((day) => ({
      ...day,
      locations: day.locations.map((loc) => ({ ...loc, ...found.get(loc._id) })),
    }))
  }

  async function submit(event: FormEvent, status: 'draft' | 'published') {
    event.preventDefault()
    setPinning(true)
    const days = await pinByName(form.days).finally(() => setPinning(false))
    // Show the new pins in the form too, in case saving fails and they try again.
    if (days !== form.days) setForm((current) => ({ ...current, days }))
    mutation.mutate(buildPayload(status, days), {
      onSuccess: (post) => {
        // Drafts live in Your Activity → Journeys; a published journey opens itself.
        void navigate(post.status === 'draft' ? '/activity/journeys' : `/posts/${post._id}`)
      },
    })
  }

  if (isEdit && isLoadingPost) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-80" />
        <div className="mt-10 space-y-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title={isEdit ? 'Chỉnh sửa hành trình' : 'Đăng hành trình mới'}
        description="Kể lại chuyến đi theo từng ngày. Càng ghi rõ chi phí và ghi chú, người clone lịch trình của bạn càng đỡ phải đoán."
      />

      <form
        onSubmit={(e) => void submit(e, 'published')}
        className="animate-fade-rise-delay grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
      >
        <div className="space-y-8">
          {/* Basics */}
          <GlassCard className="space-y-5 p-6">
            <h2 className="font-display text-2xl">Thông tin chung</h2>

            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Tóm tắt</Label>
              <Textarea
                id="summary"
                required
                rows={3}
                value={form.summary}
                onChange={(e) => patch({ summary: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverUrl">Ảnh bìa</Label>
              <CoverPicker
                value={form.coverUrl}
                onChange={(coverUrl) => patch({ coverUrl })}
                fallbackUrl={autoCover}
                disabled={mutation.isPending || pinning}
              />
            </div>
          </GlassCard>

          {/* Days */}
          <section className="space-y-5" data-editor-days>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">
                Lịch trình ({form.days.length} ngày)
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={addDay}>
                <Plus />
                Thêm ngày
              </Button>
            </div>

            {form.days.map((day, index) => (
              <DayBuilder
                key={day._id}
                day={day}
                index={index}
                canRemove={form.days.length > 1}
                onChange={updateDay}
                onRemove={() => removeDay(day._id)}
              />
            ))}
          </section>

          {/* The route as it will appear on the journey, updated as stops are pinned. */}
          <GlassCard as="section" aria-label="Xem trước bản đồ tuyến" className="space-y-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl">Bản đồ tuyến</h2>
              <p className="text-sm text-muted-foreground">
                {pinnedStops}/{totalStops} điểm dừng đã ghim
              </p>
            </div>
            <MapPreview route={routePreview} className="h-72 w-full" label="Xem trước tuyến hành trình" />
            <p className="text-xs text-muted-foreground">
              Chỉ những điểm dừng đã ghim mới hiện trên bản đồ. Ghim bằng ô Địa chỉ: chọn gợi ý, dán link Google
              Maps, hoặc chọn trên bản đồ.
            </p>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-32">
          <GlassCard className="space-y-5 p-6">
            <h2 className="font-display text-2xl">Phân loại</h2>

            <div className="space-y-2">
              <Label>Khu vực</Label>
              <Select
                value={form.region}
                onValueChange={(value) => patch({ region: value as Region })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((region) => (
                    <SelectItem key={region} value={region}>
                      {REGION_LABELS[region]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mùa</Label>
              <Select
                value={form.season}
                onValueChange={(value) => patch({ season: value as Season })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((season) => (
                    <SelectItem key={season} value={season}>
                      {SEASON_LABELS[season]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mức chi tiêu</Label>
              <Select
                value={form.budgetLevel}
                onValueChange={(value) => patch({ budgetLevel: value as BudgetLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {BUDGET_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Thẻ</Label>
              <TagPicker value={form.tags} onChange={(tags) => patch({ tags })} />
            </div>
          </GlassCard>

          <GlassCard className="space-y-4 p-6">
            <div>
              <p className="text-sm text-muted-foreground">
                Tổng chi phí ước tính
              </p>
              <p className="mt-1 font-display text-3xl">
                {formatVnd(totalEstCost)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tự động cộng từ các điểm dừng.
              </p>
            </div>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message}
              </p>
            )}

            <div className="space-y-2">
              <GlassButton
                type="submit"
                size="lg"
                className="w-full"
                disabled={mutation.isPending || pinning}
              >
                {mutation.isPending || pinning ? <Loader2 className="animate-spin" /> : <Save />}
                {isEdit ? 'Lưu thay đổi' : 'Đăng hành trình'}
              </GlassButton>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={mutation.isPending || pinning}
                onClick={(e) => void submit(e, 'draft')}
              >
                Lưu nháp
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Bản nháp được lưu vào tài khoản của bạn. Xem lại ở Hoạt động của bạn → Hành trình.
            </p>
          </GlassCard>
        </aside>
      </form>
    </PageContainer>
  )
}
