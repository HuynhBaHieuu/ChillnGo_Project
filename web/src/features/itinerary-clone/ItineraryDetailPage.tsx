import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ArrowLeft, GitMerge, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { MapPreview } from '@/components/MapPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MergeModal } from '@/features/itinerary-clone/components/MergeModal'
import { SortableDay } from '@/features/itinerary-clone/components/SortableDay'
import {
  useItinerary,
  useRemoveDay,
  useReorderDays,
} from '@/features/itinerary-clone/hooks'
import { formatShortDate, formatVnd, tripLengthLabel } from '@/lib/format'
import { moveItem, totalCostOf } from '@/lib/itinerary'
import type {
  ClonedItinerary,
  ItineraryStatus,
  TripDay,
} from '@/services/types'

const STATUS_LABELS: Record<ItineraryStatus, string> = {
  planning: 'Đang lên kế hoạch',
  confirmed: 'Đã chốt',
  completed: 'Đã đi',
}

export function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: itinerary, isPending, isError } = useItinerary(id)

  const reorder = useReorderDays(id ?? '')
  const removeDay = useRemoveDay(id ?? '')

  /**
   * Local copy of the day order so dragging feels instant.
   *
   * Re-synced whenever the server hands back a new itinerary object — which
   * happens after every reorder, merge and delete, since those mutations write
   * the response straight into the query cache. Done during render rather than
   * in an effect so the list never paints stale for a frame.
   */
  const [days, setDays] = useState<TripDay[]>([])
  const [syncedFrom, setSyncedFrom] = useState<ClonedItinerary | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)

  if (itinerary && itinerary !== syncedFrom) {
    setSyncedFrom(itinerary)
    setDays(itinerary.days)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** Recalculated from the local day list, so it updates as items move. */
  const liveTotal = useMemo(() => totalCostOf(days), [days])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = days.findIndex((d) => d._id === active.id)
    const to = days.findIndex((d) => d._id === over.id)
    if (from === -1 || to === -1) return

    const next = moveItem(days, from, to)
    setDays(next)
    reorder.mutate(next.map((d) => d._id))
  }

  if (isPending) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-96" />
        <div className="mt-10 space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (isError || !itinerary) {
    return (
      <PageContainer>
        <EmptyState
          title="Không tìm thấy lịch trình"
          description="Lịch trình này có thể đã bị xoá."
          action={
            <Button asChild variant="outline">
              <Link to="/itineraries">Về danh sách</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Link
        to="/itineraries"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Hành trình của tôi
      </Link>

      <header className="animate-fade-rise mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STATUS_LABELS[itinerary.status]}</Badge>
            <span className="text-xs text-muted-foreground">
              {tripLengthLabel(days.length)} · khởi hành{' '}
              {formatShortDate(itinerary.startDate)}
            </span>
          </div>

          <h1 className="mt-5 max-w-[22ch] font-display text-4xl tracking-tight">
            {itinerary.title}
          </h1>

          {itinerary.note && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {itinerary.note}
            </p>
          )}
        </div>

        <GlassButton size="lg" onClick={() => setMergeOpen(true)} className="shrink-0">
          <GitMerge />
          Ghép từ bài khác
        </GlassButton>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Draggable days */}
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl">Các ngày</h2>
            {reorder.isPending && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Đang lưu thứ tự…
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Kéo thẻ để đổi thứ tự ngày. Ngày sẽ được đánh số và đổi ngày tháng lại
            theo thứ tự mới.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={days.map((d) => d._id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-6 space-y-4">
                {days.map((day) => (
                  <SortableDay
                    key={day._id}
                    day={day}
                    canRemove={days.length > 1}
                    onRemove={() => {
                      setDays((current) => current.filter((d) => d._id !== day._id))
                      removeDay.mutate(day._id)
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>

        {/* Live summary */}
        <aside className="space-y-6 lg:sticky lg:top-32">
          <GlassCard className="p-6">
            <p className="text-sm text-muted-foreground">
              Tổng chi phí
            </p>
            <p className="mt-1 font-display text-4xl tracking-tight">
              {formatVnd(liveTotal)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tính lại tức thì mỗi khi bạn đổi thứ tự, xoá hoặc ghép thêm ngày.
            </p>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số ngày</dt>
                <dd>{days.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số điểm dừng</dt>
                <dd>{days.reduce((n, d) => n + d.locations.length, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nguồn</dt>
                <dd>{itinerary.sourcePostIds.length} bài viết</dd>
              </div>
            </dl>
          </GlassCard>

          <div>
            <h2 className="font-display text-2xl">Bản đồ tuyến</h2>
            <MapPreview
              days={days}
              className="mt-4 h-72 w-full"
              label={`Bản đồ tuyến đường của ${itinerary.title}`}
            />
          </div>

          <div>
            <h2 className="font-display text-2xl">Bài viết gốc</h2>
            <ul className="mt-4 space-y-2">
              {itinerary.sourcePostIds.map((postId) => (
                <li key={postId}>
                  <Link
                    to={`/posts/${postId}`}
                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Xem bài viết gốc →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <MergeModal
        itineraryId={itinerary._id}
        sourcePostIds={itinerary.sourcePostIds}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
      />
    </PageContainer>
  )
}
