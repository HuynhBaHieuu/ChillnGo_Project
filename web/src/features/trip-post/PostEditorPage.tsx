import { Loader2, Plus, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
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
import { totalCostOf } from '@/lib/itinerary'
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
        note: '',
        estCost: 0,
        photoUrl: null,
        lng: 106.0,
        lat: 16.0,
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
  const coordinates = days.flatMap((day) =>
    day.locations.map((loc): [number, number] => [loc.lng, loc.lat]),
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

  const createPost = useCreatePost()
  const updatePost = useUpdatePost(id ?? '')
  const mutation = isEdit ? updatePost : createPost

  const totalEstCost = useMemo(() => totalCostOf(form.days), [form.days])

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

  function buildPayload(status: 'draft' | 'published'): TripPostPayload {
    const sorted = [...form.days].sort((a, b) => a.date.localeCompare(b.date))
    const days = form.days.map((day, i) => ({ ...day, dayNumber: i + 1 }))
    const coverSeed = form.title.slice(0, 30) || 'chillngo'

    return {
      authorId: user?._id ?? '',
      title: form.title.trim(),
      summary: form.summary.trim(),
      coverUrl: form.coverUrl.trim() || travelCover(coverSeed, themeFromText(form.title)),
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

  function submit(event: FormEvent, status: 'draft' | 'published') {
    event.preventDefault()
    mutation.mutate(buildPayload(status), {
      onSuccess: (post) => {
        void navigate(`/posts/${post._id}`)
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
        onSubmit={(e) => submit(e, 'published')}
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
                placeholder="Hà Giang Loop 4N3Đ — cung đường đá và mây"
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
                placeholder="Một đoạn ngắn nói rõ chuyến đi này hợp với ai và có gì đáng đi."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverUrl">Ảnh bìa (URL)</Label>
              <Input
                id="coverUrl"
                value={form.coverUrl}
                onChange={(e) => patch({ coverUrl: e.target.value })}
                placeholder="Để trống sẽ dùng ảnh placeholder"
              />
            </div>
          </GlassCard>

          {/* Days */}
          <section className="space-y-5">
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
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {isEdit ? 'Lưu thay đổi' : 'Đăng hành trình'}
              </GlassButton>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={mutation.isPending}
                onClick={(e) => submit(e, 'draft')}
              >
                Lưu nháp
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Payload gửi đi được in ra console theo đúng schema <code>TripPost</code>.
            </p>
          </GlassCard>
        </aside>
      </form>
    </PageContainer>
  )
}
