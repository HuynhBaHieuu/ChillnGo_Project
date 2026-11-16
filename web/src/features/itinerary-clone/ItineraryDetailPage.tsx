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
import { ArrowLeft, GitMerge, Loader2, Pencil, Share2, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DayMap, DayPills } from '@/features/itinerary-clone/components/DayMap'
import { MergeModal } from '@/features/itinerary-clone/components/MergeModal'
import { ShareDialog } from '@/features/itinerary-clone/components/ShareDialog'
import { SortableDay } from '@/features/itinerary-clone/components/SortableDay'
import {
  useItinerary,
  useRemoveDay,
  useReorderDays,
} from '@/features/itinerary-clone/hooks'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { tr } from '@/i18n/rich'
import { translateServerMessage } from '@/i18n/server'
import { formatShortDate, formatVnd, tripLengthLabel } from '@/lib/format'
import { moveItem, totalCostOf } from '@/lib/itinerary'
import type {
  ClonedItinerary,
  ItineraryStatus,
  TripDay,
} from '@/services/types'

const STATUS_LABELS: Record<ItineraryStatus, MessageKey> = {
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
  const [shareOpen, setShareOpen] = useState(false)
  // The day the map is framed on; null shows the whole trip.
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const dayRefs = useRef(new Map<string, HTMLElement>())

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
      <PageContainer wide>
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
      <PageContainer wide>
        <EmptyState
          title={t('Không tìm thấy lịch trình')}
          description={t('Lịch trình này có thể đã bị xoá.')}
          action={
            <Button asChild variant="outline">
              <Link to="/itineraries">{t('Về danh sách')}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  // A day can be deleted while focused.
  const focus = focusDay !== null && focusDay < days.length ? focusDay : null

  /** Frames the map on a day and, when asked, scrolls the list to it (a stop tapped on the map). */
  function showDay(index: number | null, scroll = false) {
    setFocusDay(index)
    const id = index === null ? undefined : days[index]?._id
    if (scroll && id) dayRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PageContainer wide>
      <Link
        to="/itineraries"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('Hành trình của tôi')}
      </Link>

      <header className="animate-fade-rise mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(STATUS_LABELS[itinerary.status])}</Badge>
            {(itinerary.cloneType === 'ai' || itinerary.cloneType === 'merge') && (
              <Badge variant="outline" className="gap-1 border-np-teal/50 text-np-teal">
                <Sparkles className="size-3" />
                {t('Điều chỉnh bằng AI')}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {tripLengthLabel(days.length)} · {t('khởi hành {date}', { date: formatShortDate(itinerary.startDate) })}
            </span>
          </div>

          <h1 className="mt-5 max-w-[22ch] font-display text-4xl tracking-tight">
            {itinerary.title}
          </h1>

          <SourceCredit itinerary={itinerary} />

          {itinerary.note && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {translateServerMessage(itinerary.note)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <GlassButton asChild size="lg" tone="sunset">
            <Link to={`/itineraries/${itinerary._id}/edit`}>
              <Pencil />
              {t('Chỉnh sửa')}
            </Link>
          </GlassButton>
          <GlassButton size="lg" onClick={() => setMergeOpen(true)}>
            <GitMerge />
            {t('Ghép từ bài khác')}
          </GlassButton>
          <GlassButton size="lg" onClick={() => setShareOpen(true)}>
            <Share2 />
            {itinerary.shareToken ? t('Đang chia sẻ') : t('Chia sẻ')}
          </GlassButton>
        </div>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start">
        {/* Draggable days */}
        <section className="order-last min-w-0 lg:order-first">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl">{t('Các ngày')}</h2>
            {reorder.isPending && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {t('Đang lưu thứ tự…')}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {t('Kéo thẻ để đổi thứ tự ngày. Ngày sẽ được đánh số và đổi ngày tháng lại theo thứ tự mới.')}
          </p>

          <div className="sticky top-20 z-10 -mx-2 mt-4 rounded-2xl bg-background/90 px-2 py-2 backdrop-blur">
            <DayPills days={days} value={focus} onChange={(i) => showDay(i, true)} />
          </div>

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
                {days.map((day, index) => (
                  <div
                    key={day._id}
                    className="scroll-mt-36"
                    ref={(el) => {
                      if (el) dayRefs.current.set(day._id, el)
                      else dayRefs.current.delete(day._id)
                    }}
                  >
                  <SortableDay
                    day={day}
                    focused={focus === index}
                    onSelect={() => setFocusDay(focus === index ? null : index)}
                    canRemove={days.length > 1}
                    onRemove={() => {
                      setDays((current) => current.filter((d) => d._id !== day._id))
                      removeDay.mutate(day._id)
                      setFocusDay(null)
                    }}
                  />
                  </div>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <div className="mt-10 space-y-8">
          <GlassCard className="p-6">
            <p className="text-sm text-muted-foreground">
              {t('Tổng chi phí')}
            </p>
            <p className="mt-1 font-display text-4xl tracking-tight">
              {formatVnd(liveTotal)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Tính lại tức thì mỗi khi bạn đổi thứ tự, xoá hoặc ghép thêm ngày.')}
            </p>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('Số ngày')}</dt>
                <dd>{days.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('Số điểm dừng')}</dt>
                <dd>{days.reduce((n, d) => n + d.locations.length, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('Nguồn')}</dt>
                <dd>{t('{n} bài viết', { n: itinerary.sourcePostIds.length })}</dd>
              </div>
            </dl>
          </GlassCard>

          {itinerary.checklist && itinerary.checklist.groups.length > 0 && (
            <div>
              <h2 className="font-display text-2xl">{t('Chuẩn bị')}</h2>
              <div className="mt-4 space-y-4">
                {itinerary.checklist.groups.map((group) => (
                  <div key={group.group}>
                    <h3 className="text-sm font-medium">{group.group}</h3>
                    <ul className="mt-1.5 space-y-1">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-np-teal" />
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-display text-2xl">{t('Bài viết gốc')}</h2>
            <ul className="mt-4 space-y-2">
              {itinerary.sourcePostIds.map((postId) => {
                const source = itinerary.sources?.find((s) => s.postId === postId)
                return (
                  <li key={postId} className="text-sm text-muted-foreground">
                    <Link
                      to={`/posts/${postId}`}
                      className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {source?.title ? `“${source.title}”` : t('Xem bài viết gốc')} →
                    </Link>
                    {source?.author && <span> {t('của {name}', { name: `@${source.author.username}` })}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
          </div>
        </section>

        {/* Live summary */}
        <aside className="min-w-0 lg:sticky lg:top-24">
          <DayMap
            days={days}
            focus={focus}
            onFocus={(i) => showDay(i, true)}
            title={itinerary.title}
            className="h-[45vh] lg:h-[calc(100dvh-8rem)]"
          />
        </aside>
      </div>

      <MergeModal
        itineraryId={itinerary._id}
        sourcePostIds={itinerary.sourcePostIds}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
      />
      <ShareDialog itinerary={itinerary} open={shareOpen} onOpenChange={setShareOpen} />
    </PageContainer>
  )
}

/** "Phỏng theo hành trình của @…": every author whose journey this itinerary was made from. */
function SourceCredit({ itinerary }: { itinerary: ClonedItinerary }) {
  const authors = (itinerary.sources ?? []).filter(
    (s, i, all) => s.author && all.findIndex((o) => o.author?._id === s.author?._id) === i,
  )
  if (authors.length === 0) return null
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      {tr('Phỏng theo hành trình của {authors}', {
        authors: authors.map((source, i) => (
          <span key={source.postId}>
            {i > 0 && ', '}
            <Link to={`/posts/${source.postId}`} className="text-foreground underline-offset-4 hover:underline">
              @{source.author?.username}
            </Link>
          </span>
        )),
      })}
    </p>
  )
}
