import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  CloudRain,
  CornerDownRight,
  ListChecks,
  Loader2,
  MapPin,
  RotateCcw,
  Route,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { MapPreview } from '@/components/MapPreview'
import { PillTabs } from '@/components/PillNav'
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
import { dayColor } from '@/features/map/geometry'
import { localeTag, t, tx } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { tr } from '@/i18n/rich'
import { formatLongDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AiChangeStatus, AiChangeType, AiDraft, AiDraftStop, AiPlace, ItinerarySource, TripDay } from '@/services/types'

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
          <Link to={`/posts/${source.postId}`} className="font-medium text-foreground underline underline-offset-4 hover:text-np-teal">
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

/** A reason's first sentence, which is highlighted, and the rest. */
function splitLead(text: string): [string, string] {
  const match = /^(.+?[.!?…])(\s+[\s\S]+)$/.exec(text)
  return match ? [match[1], match[2]] : [text, '']
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

/** Below the fixed navbar, the chat and the plan each scroll on their own (large screens). */
const SPLIT = 'lg:h-[calc(100dvh-6rem)]'

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
  /** The day shown, by position (1 = first day); 0 shows every day. Shared with the map. */
  const [day, setDay] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const mapDays = useMemo(() => (draft ? mapDaysOf(draft) : []), [draft])
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
      <div className="np-page bg-[hsl(var(--background))] pt-24">
        <div className={cn('mx-auto grid max-w-[110rem] gap-6 px-4 lg:grid-cols-[25rem_minmax(0,1fr)] lg:px-0', SPLIT)}>
          <Skeleton className="hidden h-full rounded-none lg:block" />
          <div className="space-y-5 lg:px-8">
            <Skeleton className="h-9 w-96 max-w-full" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-11 w-72 rounded-full" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </div>
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
  const days = draft.days.map((d, i) => ({ ...d, position: i + 1 }))
  const shownDays = day ? days.filter((d) => d.position === day) : days

  /** Pick a day from the tabs or the map; the plan goes back to its top. */
  function pickDay(next: number) {
    setDay(next)
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const actionsFor = (changeId: string, type: AiChangeType, status: AiChangeStatus) => {
    const actions = committed ? [] : actionsOf(type, status)
    if (actions.length === 0) return null
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => change(changeId, action.status)}
            className="h-9 rounded-full px-4"
          >
            <action.icon className="size-4" />
            {t(action.label)}
          </Button>
        ))}
      </div>
    )
  }

  // The AI's opening words in the chat: what it adapted, and the season.
  const intro =
    source || season.length > 0 ? (
      <>
        {source && (
          <p>
            {tr(draft.sources.length > 1 ? 'Gộp từ các hành trình {sources}. Khởi hành {date}.' : 'Phỏng theo hành trình {sources}. Khởi hành {date}.', {
              sources: <SourcesLine sources={draft.sources} />,
              date: formatLongDate(form.startDate),
            })}
          </p>
        )}
        {season.map((note) => (
          <span key={note} className="mt-3 flex items-start gap-2 text-muted-foreground">
            <CloudRain className="mt-0.5 size-4 shrink-0 text-np-teal" aria-hidden />
            {note}
          </span>
        ))}
      </>
    ) : undefined

  return (
    <div className="np-page bg-[hsl(var(--background))] pb-32 pt-24 text-foreground md:pb-20 lg:pb-0">
      <div className={cn('mx-auto flex max-w-[110rem] flex-col lg:grid lg:grid-cols-[25rem_minmax(0,1fr)]', SPLIT)}>
        <ChatPanel
          draft={draft}
          busy={busy}
          intro={intro}
          className="order-last mt-10 border-y border-border lg:order-none lg:mt-0 lg:h-full lg:border-y-0 lg:border-r"
        />

        {/* The plan, beside the chat: like a canvas the chat edits. */}
        <div ref={canvasRef} className="min-w-0 px-4 sm:px-6 lg:h-full lg:overflow-y-auto lg:px-8 lg:pb-10">
          <header className="animate-fade-rise flex flex-col gap-4 pt-2 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {source && (
                  <Link
                    to={`/posts/${source.postId}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                    {t('Hành trình gốc')}
                  </Link>
                )}
                <span className="inline-flex items-center gap-1.5 text-np-teal">
                  <Sparkles className="size-4" />
                  {t('Bản nháp AI')}
                </span>
              </div>
              <h1 className="mt-2 font-display text-[1.75rem] font-extrabold leading-8 tracking-tight">
                {t('{place} {days} ngày cho {people} người', {
                  place: draft.destination ?? t('Lịch trình'),
                  days: form.days,
                  people: form.groupSize,
                  n: form.groupSize,
                })}
              </h1>
            </div>

            {committed ? (
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-np-teal">
                  <CheckCheck className="size-4" />
                  {t('Đã lưu vào lịch trình của bạn')}
                </span>
                <GlassButton asChild tone="sunset">
                  <Link to={`/itineraries/${draft.committedItineraryId}`}>{t('Mở lịch trình')}</Link>
                </GlassButton>
              </div>
            ) : (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
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
          </header>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:items-start">
            {/* The map: above the plan on smaller screens, held beside it on wide ones. */}
            <div className="order-2 xl:sticky xl:top-4 xl:order-last">
              <MapPreview
                days={mapDays}
                day={day || null}
                onDayChange={(next) => pickDay(next ?? 0)}
                className="h-64 w-full sm:h-80 xl:h-[calc(100dvh-8rem)]"
                label={t('Bản đồ các điểm trong bản nháp')}
              />
            </div>

            <div className="contents xl:block xl:min-w-0">
              {/* Cost against budget, and what is left to review. */}
              <div className="order-1 rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">{t('Tổng chi phí ước tính')}</p>
                    <p className={cn('mt-0.5 font-display text-2xl font-bold tracking-tight', cost.overBudget && 'text-destructive')}>
                      {formatVnd(cost.total)}
                      {cost.budget !== null && (
                        <span className="ml-2 inline-block whitespace-nowrap text-sm font-normal text-muted-foreground">
                          / {t('ngân sách {amount}', { amount: formatVnd(cost.budget) })}
                        </span>
                      )}
                    </p>
                    {cost.budget !== null && cost.budget > 0 && (
                      <div className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-np-well" aria-hidden>
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
                  <div className="text-xs text-muted-foreground 2xl:text-right">
                    {!committed && (
                      <p className="text-sm text-foreground">
                        {draft.pendingCount > 0 ? t('Còn {n} thay đổi chờ duyệt', { n: draft.pendingCount }) : t('Đã duyệt hết thay đổi')}
                      </p>
                    )}
                    <p className="mt-1">
                      {t('Bản nháp tự xoá sau 24 giờ, lúc {time}.', {
                        time: new Date(draft.expiresAt).toLocaleString(localeTag(), {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        }),
                      })}
                    </p>
                  </div>
                </div>

                {draft.warnings.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                    {draft.warnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-2 text-sm text-[hsl(var(--np-ochre))]">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
                {failure && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {failure.message}
                  </p>
                )}
              </div>

              <div className="order-1 xl:mt-5">
                <PillTabs
                  label={t('Chọn ngày để xem đường đi')}
                  value={day}
                  onChange={pickDay}
                  items={[
                    { value: 0, label: t('Tất cả') },
                    ...days.map((d) => ({
                      value: d.position,
                      label: t('Ngày {n}', { n: d.dayIndex }),
                      leading: <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(d.position) }} aria-hidden />,
                    })),
                  ]}
                  className="w-fit"
                />
              </div>

                <div className="order-3 min-w-0 space-y-10 xl:mt-8">
                  {shownDays.map((d) => (
                    <section key={d.dayIndex} aria-label={t('Ngày {n}', { n: d.dayIndex })}>
                      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                        <div>
                          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: dayColor(d.position) }} aria-hidden />
                            {t('Ngày {n}', { n: d.dayIndex })}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatLongDate(d.date)} · {t('Ước tính')} <span className="text-foreground">{formatVnd(d.cost.total)}</span>
                            {d.cost.missing > 0 && ` · ${t('{n} điểm chưa có giá', { n: d.cost.missing })}`}
                          </p>
                        </div>
                        {!committed && d.stops.length >= 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => sortRoute(d.dayIndex)}
                            className="h-9 rounded-full px-4"
                          >
                            {optimize.isPending && optimize.variables === d.dayIndex ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Route className="size-4" />
                            )}
                            {t('Tối ưu tuyến')}
                          </Button>
                        )}
                      </header>
                      {routeNotes[d.dayIndex] && (
                        <p role="status" className="mt-3 text-sm text-np-teal">
                          {routeNotes[d.dayIndex]}
                        </p>
                      )}

                      {d.stops.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{t('Ngày này chưa có điểm nào.')}</p>}

                      <ol className="mt-4 space-y-4">
                        {d.stops.map((stop, i) => (
                          <StopCard
                            key={stop.changeId}
                            stop={stop}
                            order={i + 1}
                            color={dayColor(d.position)}
                            actions={actionsFor(stop.changeId, stop.type, stop.status)}
                          />
                        ))}
                      </ol>
                    </section>
                  ))}

                  {draft.notInPlan.length > 0 && (
                    <section>
                      <h2 className="font-display text-xl font-extrabold">{t('Không có trong lịch trình')}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('Điểm của hành trình gốc mà AI đã bỏ, và gợi ý bạn đã gạt đi. Khôi phục để đưa lại vào lịch trình.')}
                      </p>
                      <ul className="mt-4 space-y-3">
                        {draft.notInPlan.map((item) => {
                          const label =
                            item.type === 'add'
                              ? { text: t('Bạn đã bỏ'), tone: 'border-border text-muted-foreground' }
                              : labelOf(item.type, item.status)
                          return (
                            <li
                              key={item.changeId}
                              className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <h3 className="font-display font-bold">{item.place.name}</h3>
                                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', label.tone)}>
                                    {label.text}
                                  </span>
                                </div>
                                {item.reason && <p className="text-sm text-muted-foreground">{item.reason}</p>}
                              </div>
                              {actionsFor(item.changeId, item.type, item.status)}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )}

                  <section className="rounded-2xl border border-border p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
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
                          className="rounded-full"
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
                  </section>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** One stop: photo, numbered name in its day's colour (as on the map), cost, facts, the AI's reason, and its buttons. */
function StopCard({ stop, order, color, actions }: { stop: AiDraftStop; order: number; color: string; actions: React.ReactNode }) {
  const label = labelOf(stop.type, stop.status)
  const note = costNote(stop.place)
  // A reverted change is the user's call: the AI's reason for it no longer applies.
  const reason = stop.reason && stop.status !== 'reverted' ? splitLead(stop.reason) : null

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border p-4 transition-colors hover:border-foreground/25 sm:flex-row">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-np-well sm:aspect-square sm:w-44 2xl:w-52">
        {stop.place.photoUrl ? (
          <img src={stop.place.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <MapPin className="size-8" aria-hidden />
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 rounded-full border bg-[hsl(var(--background)/0.85)] px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm',
            label.tone,
          )}
        >
          {label.text}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-bold leading-snug">
            <span style={{ color }}>{order}.</span> {stop.place.name}
          </h3>
          <p className="shrink-0 text-right">
            <span className={cn('block font-display text-lg font-bold', stop.place.cost === null && 'text-sm font-normal italic text-muted-foreground')}>
              {costText(stop.place)}
            </span>
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
          </p>
        </div>

        <p className="mt-1 text-[13px] text-muted-foreground">
          <time className="tabular-nums">
            {stop.startTime}–{stop.endTime}
          </time>
          {factsOf(stop.place).map((fact) => ` · ${fact}`)}
          {stop.status === 'accepted' && stop.type !== 'keep' && ` · ${t('đã chấp nhận')}`}
        </p>

        {stop.type === 'replace' && stop.status !== 'reverted' && stop.original && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tr('Thay cho {name}', { name: <span className="line-through">{stop.original.name}</span> })}
          </p>
        )}

        {reason && (
          <p className="mt-3 text-sm leading-relaxed">
            <mark className="rounded bg-np-teal/20 px-1 text-foreground [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {reason[0]}
            </mark>
            {reason[1]}
          </p>
        )}

        {stop.planB && (
          <p className="mt-2 flex gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Plan B: <span className="text-foreground">{stop.planB.place.name}</span>. {stop.planB.reason}
            </span>
          </p>
        )}

        {actions && <div className="mt-auto pt-4">{actions}</div>}
      </div>
    </li>
  )
}
