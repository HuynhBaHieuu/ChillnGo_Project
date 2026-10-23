import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  CloudRain,
  CornerDownRight,
  ListChecks,
  Loader2,
  RotateCcw,
  Route,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GlassCard } from '@/components/GlassCard'
import { MapPreview } from '@/components/MapPreview'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatPanel } from '@/features/ai-clone/ChatPanel'
import {
  useAcceptAll,
  useAiDraft,
  useCommitDraft,
  useCreateChecklist,
  useOptimizeRoute,
  useSetChangeStatus,
} from '@/features/ai-clone/hooks'
import { localeTag, t, tx } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { tr } from '@/i18n/rich'
import { formatLongDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AiChangeStatus, AiChangeType, AiDraft, AiPlace, ItinerarySource, TripDay } from '@/services/types'

/** "3,2 km" — Vietnamese decimal comma. */
function km(value: number): string {
  return `${value.toLocaleString(localeTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

/** What the season data says about the trip, in words; nothing without data. */
function seasonNotes(draft: AiDraft): string[] {
  const season = draft.season
  if (!season) return []
  const where = draft.destination ?? t('điểm đến')
  return [
    season.rainy &&
      t('Theo dữ liệu ChillnGo, chuyến đi rơi vào mùa mưa ở {place}: AI ưu tiên điểm trong nhà, và Plan B của điểm ngoài trời là chỗ trong nhà.', { place: where }),
    season.peak && t('Đang mùa cao điểm: nên đặt phòng và vé sớm.'),
    ...season.festivals.map((f) => t('Trong thời gian này có {name} (tháng {month}).', { name: f.name, month: f.month })),
  ].filter((note): note is string => Boolean(note))
}

/** Each journey this draft adapts, with its author: “A” của @a và “B” của @b. */
function SourcesLine({ sources }: { sources: ItinerarySource[] }) {
  return (
    <>
      {sources.map((source, i) => (
        <span key={source.postId}>
          {i > 0 && (i === sources.length - 1 ? ` ${t('và')} ` : ', ')}
          <Link to={`/posts/${source.postId}`} className="text-foreground underline-offset-4 hover:underline">
            “{source.title}”
          </Link>
          {source.author && (
            <>
              {' '}{t('của')}{' '}
              <Link to={`/users/${source.author._id}`} className="text-foreground underline-offset-4 hover:underline">
                @{source.author.username}
              </Link>
            </>
          )}
        </span>
      ))}
    </>
  )
}

/** What a change did, and its colour in the diff. */
function labelOf(type: AiChangeType, status: AiChangeStatus): { text: string; tone: string } {
  if (type === 'keep') return { text: t('Giữ nguyên'), tone: 'border-np-sage/40 text-np-sage' }
  if (type === 'replace' && status === 'reverted') return { text: t('Dùng điểm gốc'), tone: 'border-np-sage/40 text-np-sage' }
  if (type === 'replace') return { text: t('Thay thế'), tone: 'border-[hsl(var(--np-ochre)/0.5)] text-[hsl(var(--np-ochre))]' }
  if (type === 'add') return { text: t('Thêm mới'), tone: 'border-np-teal/50 text-np-teal' }
  if (status === 'reverted') return { text: t('Khôi phục'), tone: 'border-np-sage/40 text-np-sage' }
  return { text: t('Đã bỏ'), tone: 'border-destructive/50 text-destructive' }
}

type Action = { label: MessageKey; status: AiChangeStatus; icon: typeof Check }

/** The buttons a change offers in its current state. */
function actionsOf(type: AiChangeType, status: AiChangeStatus): Action[] {
  const accept: Action = { label: 'Chấp nhận', status: 'accepted', icon: Check }
  if (type === 'keep') return []
  if (type === 'replace') {
    if (status === 'reverted') return [{ label: 'Dùng gợi ý AI', status: 'pending', icon: Sparkles }]
    return [...(status === 'pending' ? [accept] : []), { label: 'Hoàn tác', status: 'reverted', icon: Undo2 }]
  }
  if (type === 'add') {
    if (status === 'reverted') return [{ label: 'Thêm lại', status: 'pending', icon: RotateCcw }]
    return [...(status === 'pending' ? [accept] : []), { label: 'Bỏ điểm này', status: 'reverted', icon: Undo2 }]
  }
  if (status === 'reverted') return [{ label: 'Bỏ lại', status: 'pending', icon: Undo2 }]
  return [
    ...(status === 'pending' ? [{ ...accept, label: 'Đồng ý bỏ' } as Action] : []),
    { label: 'Khôi phục', status: 'reverted', icon: RotateCcw },
  ]
}

function costText(place: AiPlace): string {
  if (place.cost === null) return t('Chưa có dữ liệu')
  if (place.cost === 0) return t('Miễn phí')
  return formatVnd(place.cost)
}

function costNote(place: AiPlace): string | null {
  if (place.costBasis === 'perPerson' && place.avgCost) return t('{price}/người', { price: formatVnd(place.avgCost) })
  if (place.costBasis === 'author') return t('theo chi phí tác giả ghi')
  return null
}

/** Facts ChillnGo has about a place; unknown ones are left out. */
function factsOf(place: AiPlace): string[] {
  return [
    place.category && tx(place.category),
    place.openingHours && t('Mở {open}–{close}', { open: place.openingHours.open, close: place.openingHours.close }),
    place.isOutdoor === true ? t('Ngoài trời') : place.isOutdoor === false ? t('Trong nhà') : null,
    place.requiresBooking && t('Cần đặt trước'),
    place.rating !== null && `★ ${place.rating.toLocaleString(localeTag())}`,
  ].filter((f): f is string => Boolean(f))
}

/** The draft's stops as journey days, for the map. Stops with no position stay off it. */
function mapDaysOf(draft: AiDraft): TripDay[] {
  return draft.days.map((day) => ({
    _id: `d${day.dayIndex}`,
    dayNumber: day.dayIndex,
    date: day.date,
    title: '',
    photos: [],
    locations: day.stops.map((stop) => ({
      _id: stop.changeId,
      name: stop.place.name,
      note: '',
      estCost: stop.place.cost ?? 0,
      photoUrl: stop.place.photoUrl,
      lat: stop.place.lat ?? 16,
      lng: stop.place.lng ?? 106,
    })),
  }))
}

export function AiDraftPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: draft, isPending, isError, error } = useAiDraft(id)
  const setStatus = useSetChangeStatus(id)
  const acceptAll = useAcceptAll(id)
  const commit = useCommitDraft(id)
  const optimize = useOptimizeRoute(id)
  const checklist = useCreateChecklist(id)
  const navigate = useNavigate()
  /** What the route optimiser said about each day it was asked to sort. */
  const [routeNotes, setRouteNotes] = useState<Record<number, string>>({})
  /**
   * One edit at a time. `busy` only disables the buttons on the next render; a
   * double click lands both clicks before it, so this catches the second.
   */
  const acting = useRef(false)
  function once(run: (done: () => void) => void) {
    if (acting.current) return
    acting.current = true
    run(() => {
      acting.current = false
    })
  }

  if (isPending) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-6 h-28 rounded-2xl" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </PageContainer>
    )
  }

  if (isError || !draft) {
    return (
      <PageContainer>
        <EmptyState
          title={t('Không mở được bản nháp')}
          description={(error as Error | null)?.message ?? t('Bản nháp có thể đã hết hạn.')}
          action={
            <Button asChild variant="outline">
              <Link to="/itineraries?tab=cloned">{t('Về lịch trình của tôi')}</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const busy = setStatus.isPending || acceptAll.isPending || commit.isPending || optimize.isPending || checklist.isPending
  const committed = Boolean(draft.committedItineraryId)
  const source = draft.sources[0]
  const form = draft.formInput
  const { cost } = draft
  const failure = (setStatus.error ?? acceptAll.error ?? commit.error ?? optimize.error ?? checklist.error) as Error | null
  const season = seasonNotes(draft)

  function sortRoute(dayIndex: number) {
    once((done) =>
      optimize.mutate(dayIndex, {
        onSuccess: ({ routes }) => {
          const [route] = routes
          if (!route) return
          setRouteNotes((notes) => ({
            ...notes,
            [dayIndex]: route.changed
              ? t('Đã sắp lại tuyến: quãng đường ước tính từ {before} còn {after}. Bữa ăn giữ nguyên giờ.', {
                  before: km(route.beforeKm),
                  after: km(route.afterKm),
                })
              : t('Thứ tự hiện tại đã cho tuyến ngắn hơn, nên giữ nguyên.'),
          }))
        },
        onSettled: done,
      }),
    )
  }

  function change(changeId: string, status: AiChangeStatus) {
    once((done) => setStatus.mutate({ changeId, status }, { onSettled: done }))
  }

  function save() {
    once((done) =>
      commit.mutate(undefined, {
        onSuccess: (itinerary) => void navigate(`/itineraries/${itinerary._id}`),
        onSettled: done,
      }),
    )
  }

  const actionsFor = (changeId: string, type: AiChangeType, status: AiChangeStatus) =>
    committed ? null : (
      <div className="flex flex-wrap gap-1.5">
        {actionsOf(type, status).map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => change(changeId, action.status)}
            className="h-7 rounded-full px-3 text-xs"
          >
            <action.icon className="size-3.5" />
            {t(action.label)}
          </Button>
        ))}
      </div>
    )

  return (
    <PageContainer>
      {source && (
        <Link
          to={`/posts/${source.postId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('Hành trình gốc')}
        </Link>
      )}

      <header className="animate-fade-rise mt-6">
        <p className="inline-flex items-center gap-2 text-sm text-np-teal">
          <Sparkles className="size-4" />
          {t('Bản nháp AI')}
        </p>
        <h1 className="mt-3 max-w-[26ch] font-display text-4xl tracking-tight">
          {t('{place} {days} ngày cho {people} người', {
            place: draft.destination ?? t('Lịch trình'),
            days: form.days,
            people: form.groupSize,
            n: form.groupSize,
          })}
        </h1>
        {source && (
          <p className="mt-3 text-sm text-muted-foreground">
            {tr(draft.sources.length > 1 ? 'Gộp từ các hành trình {sources}. Khởi hành {date}.' : 'Phỏng theo hành trình {sources}. Khởi hành {date}.', {
              sources: <SourcesLine sources={draft.sources} />,
              date: formatLongDate(form.startDate),
            })}
          </p>
        )}
        {season.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {season.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <CloudRain className="mt-0.5 size-4 shrink-0 text-np-teal" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Cost against budget, what is left to review, and saving. */}
      <GlassCard className="mt-8 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t('Tổng chi phí ước tính')}</p>
            <p className={cn('mt-1 font-display text-3xl tracking-tight', cost.overBudget && 'text-destructive')}>
              {formatVnd(cost.total)}
              {cost.budget !== null && (
                <span className="ml-2 text-base text-muted-foreground">/ {t('ngân sách {amount}', { amount: formatVnd(cost.budget) })}</span>
              )}
            </p>
            {cost.budget !== null && cost.budget > 0 && (
              <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-np-well" aria-hidden>
                <div
                  className={cn('h-full rounded-full', cost.overBudget ? 'bg-destructive' : 'bg-np-teal')}
                  style={{ width: `${Math.min(100, (cost.total / cost.budget) * 100)}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {cost.overBudget && cost.budget !== null && (
                <span className="text-destructive">{t('Vượt ngân sách {amount}.', { amount: formatVnd(cost.total - cost.budget) })} </span>
              )}
              {cost.missing > 0
                ? t('{n} điểm chưa có dữ liệu giá, chưa tính vào tổng.', { n: cost.missing })
                : t('Tính từ giá trung bình trong dữ liệu ChillnGo × số người.')}
            </p>
          </div>

          {committed ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-np-teal">
                <CheckCheck className="size-4" />
                {t('Đã lưu vào lịch trình của bạn')}
              </span>
              <GlassButton asChild tone="sunset">
                <Link to={`/itineraries/${draft.committedItineraryId}`}>{t('Mở lịch trình')}</Link>
              </GlassButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {draft.pendingCount > 0 ? t('Còn {n} thay đổi chờ duyệt', { n: draft.pendingCount }) : t('Đã duyệt hết thay đổi')}
              </span>
              <Button
                variant="outline"
                disabled={busy || draft.pendingCount === 0}
                onClick={() => once((done) => acceptAll.mutate(undefined, { onSettled: done }))}
              >
                <CheckCheck />
                {t('Chấp nhận tất cả')}
              </Button>
              <GlassButton tone="sunset" onClick={save} disabled={busy}>
                {commit.isPending && <Loader2 className="animate-spin" />}
                {t('Lưu vào lịch trình của tôi')}
              </GlassButton>
            </div>
          )}
        </div>

        {draft.warnings.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-border pt-4">
            {draft.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 text-sm text-[hsl(var(--np-ochre))]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        )}
        {failure && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {failure.message}
          </p>
        )}
      </GlassCard>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {draft.days.map((day) => (
            <GlassCard as="section" key={day.dayIndex} className="p-5 sm:p-7">
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div>
                  <p className="text-sm text-muted-foreground">{t('Ngày {n}', { n: day.dayIndex })}</p>
                  <h2 className="mt-1 font-display text-xl">{formatLongDate(day.date)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t('Ước tính')} <span className="text-foreground">{formatVnd(day.cost.total)}</span>
                    {day.cost.missing > 0 && ` · ${t('{n} điểm chưa có giá', { n: day.cost.missing })}`}
                  </p>
                  {!committed && day.stops.length >= 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => sortRoute(day.dayIndex)}
                      className="h-7 rounded-full px-3 text-xs"
                    >
                      {optimize.isPending && optimize.variables === day.dayIndex ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Route className="size-3.5" />
                      )}
                      {t('Tối ưu tuyến')}
                    </Button>
                  )}
                </div>
              </header>
              {routeNotes[day.dayIndex] && (
                <p role="status" className="mt-3 text-sm text-np-teal">
                  {routeNotes[day.dayIndex]}
                </p>
              )}

              {day.stops.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">{t('Ngày này chưa có điểm nào.')}</p>
              )}

              <ol className="mt-6 space-y-5">
                {day.stops.map((stop) => {
                  const label = labelOf(stop.type, stop.status)
                  const note = costNote(stop.place)
                  return (
                    <li key={stop.changeId} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                      <time className="text-sm tabular-nums text-muted-foreground sm:w-24 sm:shrink-0 sm:pt-0.5">
                        {stop.startTime}–{stop.endTime}
                      </time>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-medium">{stop.place.name}</h3>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', label.tone)}>
                            {label.text}
                          </span>
                          {stop.status === 'accepted' && stop.type !== 'keep' && (
                            <span className="text-[11px] text-muted-foreground">{t('đã chấp nhận')}</span>
                          )}
                        </div>
                        {stop.type === 'replace' && stop.status !== 'reverted' && stop.original && (
                          <p className="text-[13px] text-muted-foreground">
                            {tr('Thay cho {name}', { name: <span className="line-through">{stop.original.name}</span> })}
                          </p>
                        )}
                        <p className="text-[13px] text-muted-foreground">
                          <span className={cn(stop.place.cost === null && 'italic')}>{costText(stop.place)}</span>
                          {note && ` (${note})`}
                          {factsOf(stop.place).map((fact) => ` · ${fact}`)}
                        </p>
                        {/* A reverted change is the user's call: the AI's reason for it no longer applies. */}
                        {stop.reason && stop.status !== 'reverted' && (
                          <p className="flex gap-1.5 text-sm leading-relaxed">
                            <Sparkles className="mt-1 size-3.5 shrink-0 text-np-teal" aria-label={t('Lý do của AI')} />
                            {stop.reason}
                          </p>
                        )}
                        {stop.planB && (
                          <p className="flex gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                            <CornerDownRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <span>
                              Plan B: <span className="text-foreground">{stop.planB.place.name}</span>. {stop.planB.reason}
                            </span>
                          </p>
                        )}
                        {actionsFor(stop.changeId, stop.type, stop.status)}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </GlassCard>
          ))}

          {draft.notInPlan.length > 0 && (
            <GlassCard as="section" className="p-5 sm:p-7">
              <h2 className="font-display text-xl">{t('Không có trong lịch trình')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('Điểm của hành trình gốc mà AI đã bỏ, và gợi ý bạn đã gạt đi. Khôi phục để đưa lại vào lịch trình.')}
              </p>
              <ul className="mt-5 space-y-4">
                {draft.notInPlan.map((item) => {
                  const label =
                    item.type === 'add'
                      ? { text: t('Bạn đã bỏ'), tone: 'border-border text-muted-foreground' }
                      : labelOf(item.type, item.status)
                  return (
                    <li key={item.changeId} className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-medium">{item.place.name}</h3>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', label.tone)}>
                          {label.text}
                        </span>
                      </div>
                      {item.reason && <p className="text-sm text-muted-foreground">{item.reason}</p>}
                      {actionsFor(item.changeId, item.type, item.status)}
                    </li>
                  )
                })}
              </ul>
            </GlassCard>
          )}

          <GlassCard as="section" className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl">
                  <ListChecks className="size-5 text-np-teal" aria-hidden />
                  {t('Chuẩn bị cho chuyến đi')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {draft.checklist
                    ? draft.checklist.sortedByAi
                      ? t('AI đã sắp theo chuyến đi của bạn, từ danh sách có sẵn của ChillnGo.')
                      : t('Theo thứ tự mặc định của ChillnGo.')
                    : t('Đồ cần mang và chỗ cần đặt trước, chọn theo các điểm, mùa và nhóm của bạn. AI chỉ sắp xếp, không thêm mục.')}
                </p>
              </div>
              {!committed && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => once((done) => checklist.mutate(undefined, { onSettled: done }))}
                >
                  {checklist.isPending ? <Loader2 className="animate-spin" /> : <ListChecks />}
                  {draft.checklist ? t('Tạo lại') : t('Tạo checklist')}
                </Button>
              )}
            </div>
            {draft.checklist && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {draft.checklist.groups.map((group) => (
                  <div key={group.group}>
                    <h3 className="text-sm font-medium">{group.group}</h3>
                    <ul className="mt-2 space-y-1.5">
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
            )}
          </GlassCard>

          <section>
            <h2 className="font-display text-2xl">{t('Bản đồ tuyến')}</h2>
            <MapPreview days={mapDaysOf(draft)} className="mt-4 h-80 w-full" label={t('Bản đồ các điểm trong bản nháp')} />
          </section>
        </div>

        <aside className="min-w-0 space-y-3 lg:sticky lg:top-32">
          <ChatPanel draft={draft} busy={busy} />
          <p className="px-1 text-xs text-muted-foreground">
            {t('Bản nháp tự xoá sau 24 giờ, lúc {time}.', {
              time: new Date(draft.expiresAt).toLocaleString(localeTag(), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            })}
          </p>
        </aside>
      </div>
    </PageContainer>
  )
}
