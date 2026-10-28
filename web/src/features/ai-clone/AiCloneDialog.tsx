import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUp, Check, Loader2, MapPin, MessageSquare, Plus, Route, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { MapPreview } from '@/components/MapPreview'
import { PillTabs } from '@/components/PillNav'
import { Input } from '@/components/ui/input'
import { ProgressiveFluxLoader } from '@/components/ui/progressive-flux-loader'
import { Skeleton } from '@/components/ui/skeleton'
import { Stepper, StepperDescription, StepperIndicator, StepperItem, StepperSeparator, StepperTitle } from '@/components/ui/stepper'
import { AssistantMessage, UserMessage } from '@/features/ai-clone/ChatPanel'
import { nextWeek, parseReply, SKIP, SLOT_OF, thisWeekend } from '@/features/ai-clone/chatParse'
import type { Slot, TripAnswers } from '@/features/ai-clone/chatParse'
import { useAiCloneOptions, useCreateAiDraft } from '@/features/ai-clone/hooks'
import { dayColor } from '@/features/map/geometry'
import { t, translatedList, tx } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { formatLongDate, formatShortDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AiCloneForm, AiCloneOptions, AiPace, TripLocation, TripPostWithAuthor } from '@/services/types'

interface AiCloneDialogProps {
  post: TripPostWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PACES = translatedList<{ value: AiPace; label: string }, 'label'>([
  { value: 'relaxed', label: 'Thong thả' },
  { value: 'moderate', label: 'Vừa phải' },
  { value: 'packed', label: 'Dày đặc' },
], ['label'])

/** Shown in turn while the AI works, so a minute of waiting says what is happening. */
const STEPS: MessageKey[] = [
  'Đang đọc hành trình gốc…',
  'Đang chọn địa điểm từ dữ liệu ChillnGo…',
  'Đang xếp giờ cho từng ngày…',
  'Đang kiểm tra chi phí và giờ giấc…',
]
/** The progress (%) at which each of STEPS is shown. */
const STEP_AT = [0, 20, 45, 70]

const QUESTIONS: Record<Slot, MessageKey> = {
  when: 'Bạn định khởi hành ngày nào?',
  days: 'Chuyến đi mấy ngày? Hành trình gốc là {n} ngày.',
  group: 'Đi mấy người? Có trẻ em hay người lớn tuổi không?',
  budget: 'Tổng ngân sách cho cả nhóm khoảng bao nhiêu?',
  departure: 'Bạn xuất phát từ đâu?',
  interests: 'Bạn thích kiểu điểm nào? Chọn một hoặc vài mục rồi bấm Xong.',
  pace: 'Bạn muốn đi với nhịp độ nào?',
  merge: 'Có hành trình khác cùng điểm đến. Bạn muốn AI gộp thêm (tối đa 2) không?',
}

/** What to type when a reply was not understood (chatParse reads Vietnamese and English). */
const EXAMPLES: Record<Slot, MessageKey | null> = {
  when: '20/11',
  days: '3 ngày (1–14)',
  group: '4 người, có trẻ em',
  budget: '5 triệu',
  departure: 'TP.HCM',
  interests: null,
  pace: 'thong thả',
  merge: null,
}

const LABELS: Record<Slot, MessageKey> = {
  when: 'Ngày khởi hành',
  days: 'Số ngày',
  group: 'Số người',
  budget: 'Ngân sách',
  departure: 'Điểm xuất phát',
  interests: 'Sở thích',
  pace: 'Nhịp độ',
  merge: 'Gộp hành trình',
}

const CITIES = ['TP.HCM', 'Hà Nội', 'Đà Nẵng']

/** The months a trip from `startDate` for `days` days covers. */
function monthsOf(startDate: string, days: number): number[] {
  const start = new Date(`${startDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return []
  const months = new Set<number>()
  for (let i = 0; i < Math.min(Math.max(days, 1), 14); i++) {
    months.add(new Date(start.getTime() + i * 86_400_000).getUTCMonth() + 1)
  }
  return [...months]
}

type Message = { mine: boolean; text: string }

interface Chip {
  label: string
  /** What the chip answers; a chip with none skips the question. */
  answers?: TripAnswers
  /** Your chat bubble, when it should say more than the label ("Xong" → what was picked). */
  says?: string
  /** A toggle in a pick-several question. */
  pressed?: boolean
  onToggle?: () => void
}

/**
 * Clone with AI as a chat: it asks for your dates, group, budget, interests and
 * pace one question at a time, with quick replies, and reads free text such as
 * "3 ngày, 4 người có trẻ em, 5 triệu". The questions are asked here, not by
 * the AI, so only "Tạo bản nháp" spends an AI request; it can be pressed at any
 * time, and unanswered questions take their defaults.
 *
 * Full screen, like the draft page it leads to: the chat on the left, and on
 * the right the journey being adapted, with its days, stops and map, and what
 * the chat has gathered so far. Below large screens the two take turns.
 */
export function AiCloneDialog({ post, open, onOpenChange }: AiCloneDialogProps) {
  const options = useAiCloneOptions(post._id, open)
  const create = useCreateAiDraft(post._id)
  const navigate = useNavigate()

  const [answers, setAnswers] = useState<TripAnswers>({})
  const [settled, setSettled] = useState<Slot[]>([])
  const [mergeWith, setMergeWith] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  /** How far along the AI seems, 0–100, while it makes the draft. */
  const [progress, setProgress] = useState(0)
  /** The journey's day shown on the right, by position (1 = first); 0 shows every day. */
  const [day, setDay] = useState(0)
  /** Which side a small screen shows. */
  const [pane, setPane] = useState<'chat' | 'plan'>('chat')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const journeyRef = useRef<HTMLDivElement>(null)

  // A fresh chat each time it opens (the same render-time reset as CloneDialog).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAnswers({})
      setSettled([])
      setMergeWith([])
      setMessages([])
      setText('')
      setDay(0)
      setPane('chat')
    }
  }

  /** Closing forgets a failed attempt, so it is not shown next time. */
  function close() {
    create.reset()
    onOpenChange(false)
  }

  // ponytail: the server reports no progress, so this is a guess from the time
  // waited: quick at first, slowing, held at 95% until the draft arrives (about
  // 67% at 30 s, 90% at 60 s). Report real stages from the server to make it exact.
  useEffect(() => {
    if (!create.isPending) return
    const started = Date.now()
    const timer = setInterval(() => setProgress(95 * (1 - Math.exp(-(Date.now() - started) / 25_000))), 400)
    return () => clearInterval(timer)
  }, [create.isPending])

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, create.isPending, create.isError, settled.length])

  const data = options.data
  const slots: Slot[] = [
    'when', 'days', 'group', 'budget', 'departure',
    ...(data?.interests.length ? (['interests'] as const) : []),
    'pace',
    ...(data?.mergeable.length ? (['merge'] as const) : []),
  ]
  const asking = slots.find((s) => !settled.includes(s)) ?? null
  const left = data?.callsLeft ?? 0

  const form: AiCloneForm = {
    startDate: answers.startDate ?? nextWeek(new Date()),
    days: answers.days ?? post.days.length,
    groupSize: answers.groupSize ?? 2,
    withChildren: answers.withChildren ?? false,
    withElderly: answers.withElderly ?? false,
    budget: answers.budget ?? null,
    departure: answers.departure ?? '',
    interests: answers.interests ?? [],
    pace: answers.pace ?? 'moderate',
  }

  function question(slot: Slot | null): string {
    if (!slot) return t('Đủ thông tin rồi! Bấm “Tạo bản nháp” để AI bắt đầu, hoặc nhắn thêm nếu muốn đổi gì.')
    return t(QUESTIONS[slot], { n: post.days.length })
  }

  /** What ChillnGo's season data says about these dates; nothing without data. */
  function seasonNotes(f: AiCloneForm, opts: AiCloneOptions): string[] {
    const season = opts.season
    if (!season) return []
    const months = monthsOf(f.startDate, f.days)
    return [
      months.some((m) => season.rainyMonths.includes(m)) &&
        t('Theo dữ liệu ChillnGo, {place} đang vào mùa mưa: AI sẽ ưu tiên điểm trong nhà.', { place: opts.destination ?? '' }),
      months.some((m) => season.peakMonths.includes(m)) && t('Đang mùa cao điểm: nên đặt phòng và vé sớm.'),
      ...season.festivals.filter((f) => months.includes(f.month)).map((f) => t('Có {name} (tháng {month}).', { name: f.name, month: f.month })),
    ].filter((note): note is string => Boolean(note))
  }

  /** A slot's answer as the checklist and the chat show it. */
  function valueOf(slot: Slot, f: AiCloneForm): string {
    switch (slot) {
      case 'when':
        return formatShortDate(f.startDate)
      case 'days':
        return t('{n} ngày', { n: f.days })
      case 'group':
        return [
          String(f.groupSize),
          f.withChildren && t('Có trẻ em'),
          f.withElderly && t('Có người lớn tuổi'),
        ].filter(Boolean).join(' · ')
      case 'budget':
        return f.budget === null ? t('Không giới hạn') : formatVnd(f.budget)
      case 'departure':
        return f.departure || t('Bỏ qua')
      case 'interests':
        return f.interests.length
          ? f.interests.map((v) => tx(data?.interests.find((i) => i.value === v)?.label ?? v)).join(', ')
          : t('Tất cả')
      case 'pace':
        return PACES.find((p) => p.value === f.pace)?.label ?? ''
      case 'merge':
        return mergeWith.length
          ? mergeWith.map((id) => data?.mergeable.find((j) => j.postId === id)?.title ?? '').join(', ')
          : t('Không gộp')
    }
  }

  /**
   * One reply: a chip (`given`) or typed text. A chip always settles the
   * question asked; typed text settles every question it answers, and a
   * "bỏ qua" skips the one asked.
   */
  function reply(raw: string, given?: TripAnswers) {
    const said = raw.trim()
    if (!said || !data || create.isPending) return
    const parsed = given ?? parseReply(said, asking, data.interests, new Date())
    const skipped = !given && asking !== null && SKIP.test(said.toLowerCase())
    const nextAnswers = { ...answers, ...parsed }
    const nextSettled = new Set(settled)
    for (const key of Object.keys(parsed) as (keyof TripAnswers)[]) nextSettled.add(SLOT_OF[key])
    if (asking && (given || skipped)) nextSettled.add(asking)

    const bot: string[] = []
    if (!given && !skipped && Object.keys(parsed).length === 0) {
      const example = asking && EXAMPLES[asking]
      bot.push(
        example
          ? t('Mình chưa hiểu ý bạn. Hãy chọn một gợi ý bên dưới, hoặc nhắn kiểu: “{example}”.', { example: t(example) })
          : t('Mình chưa hiểu ý bạn. Hãy chọn một gợi ý bên dưới.'),
      )
    } else {
      const nextForm: AiCloneForm = { ...form, ...parsed }
      if (!given && Object.keys(parsed).length) {
        const touched = [...new Set((Object.keys(parsed) as (keyof TripAnswers)[]).map((k) => SLOT_OF[k]))]
        bot.push(t('Đã ghi: {items}.', { items: touched.map((s) => `${t(LABELS[s])} ${valueOf(s, nextForm)}`).join('; ') }))
      }
      // Only the season notes the chat has not said yet.
      if (parsed.startDate || parsed.days) {
        bot.push(...seasonNotes(nextForm, data).filter((note) => !messages.some((m) => m.text === note)))
      }
    }

    setAnswers(nextAnswers)
    setSettled([...nextSettled])
    // The question just answered stays in the history above its answer; the next one is asked below the chat.
    setMessages((m) => [
      ...m,
      ...(asking ? [{ mine: false, text: question(asking) }] : []),
      { mine: true, text: said },
      ...bot.map((b) => ({ mine: false, text: b })),
    ])
    setText('')
  }

  function chipsFor(slot: Slot | null, opts: AiCloneOptions): Chip[] {
    const today = new Date()
    switch (slot) {
      case 'when': {
        const week = nextWeek(today)
        const weekend = thisWeekend(today)
        return [
          { label: t('Tuần sau ({date})', { date: formatShortDate(week) }), answers: { startDate: week } },
          { label: t('Cuối tuần này ({date})', { date: formatShortDate(weekend) }), answers: { startDate: weekend } },
        ]
      }
      case 'days': {
        const n = post.days.length
        return [n - 1, n, n + 1]
          .filter((d) => d >= 1 && d <= 14)
          .map((d) => ({ label: t('{n} ngày', { n: d }), answers: { days: d } }))
      }
      case 'group':
        return [
          { label: t('Một mình'), answers: { groupSize: 1, withChildren: false, withElderly: false } },
          { label: t('Cặp đôi'), answers: { groupSize: 2, withChildren: false, withElderly: false } },
          { label: t('Gia đình 4 người, có trẻ em'), answers: { groupSize: 4, withChildren: true } },
          { label: t('Nhóm bạn 4 người'), answers: { groupSize: 4, withChildren: false, withElderly: false } },
        ]
      case 'budget':
        return [
          { label: t('Không giới hạn'), answers: { budget: null } },
          ...[3_000_000, 5_000_000, 10_000_000].map((b) => ({ label: formatVnd(b), answers: { budget: b } })),
        ]
      case 'departure':
        return [
          ...CITIES.map((c) => ({ label: tx(c), answers: { departure: c } })),
          { label: t('Bỏ qua') },
        ]
      case 'interests': {
        const picked = answers.interests ?? []
        return [
          ...opts.interests.map((i) => ({
            label: tx(i.label),
            pressed: picked.includes(i.value),
            onToggle: () =>
              setAnswers((a) => {
                const current = a.interests ?? []
                return { ...a, interests: current.includes(i.value) ? current.filter((v) => v !== i.value) : [...current, i.value] }
              }),
          })),
          {
            label: picked.length ? t('Xong') : t('Tất cả'),
            says: valueOf('interests', { ...form, interests: picked }),
            answers: { interests: picked },
          },
        ]
      }
      case 'pace':
        return PACES.map((p) => ({ label: p.label, answers: { pace: p.value } }))
      case 'merge':
        return [
          ...opts.mergeable.map((j) => {
            const pressed = mergeWith.includes(j.postId)
            return {
              label: `${j.title} · ${t('{n} ngày', { n: j.days })}`,
              pressed,
              onToggle: () =>
                setMergeWith((current) =>
                  pressed ? current.filter((id) => id !== j.postId) : current.length < 2 ? [...current, j.postId] : current,
                ),
            }
          }),
          { label: mergeWith.length ? t('Xong') : t('Không gộp'), says: valueOf('merge', form), answers: {} },
        ]
      default:
        return []
    }
  }

  /** Each draft costs an AI request: a double click must not start two. */
  const submitting = useRef(false)

  function handleSubmit() {
    if (submitting.current || !data) return
    setProgress(0)
    submitting.current = true
    create.mutate(
      { form, mergeWith },
      {
        onSuccess: (draft) => {
          onOpenChange(false)
          void navigate(`/ai-drafts/${draft._id}`)
        },
        onSettled: () => {
          submitting.current = false
        },
      },
    )
  }

  /** Pick a day from the tabs or the map; the journey goes back to its top (whichever of the two scrolls). */
  function pickDay(next: number) {
    setDay(next)
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    journeyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const days = post.days.map((d, i) => ({ ...d, position: i + 1 }))
  const shownDays = day ? days.filter((d) => d.position === day) : days
  const done = slots.filter((s) => settled.includes(s)).length

  const createButton = (
    <GlassButton tone="sunset" onClick={handleSubmit} disabled={!data || left === 0 || create.isPending} className="shrink-0">
      {create.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {create.isPending ? t('AI đang tạo bản nháp…') : mergeWith.length ? t('Gộp và tạo bản nháp') : t('Tạo bản nháp')}
    </GlassButton>
  )

  return (
    <DialogPrimitive.Root
      open={open}
      // The AI is already working on it: closing now would only hide the result.
      onOpenChange={(next) => !next && !create.isPending && close()}
    >
      <DialogPrimitive.Portal>
        {/* Radix locks the page's scroll from the overlay. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--background))]" />
        <DialogPrimitive.Content className="animate-fade-rise fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))] text-foreground lg:flex-row">
          <DialogPrimitive.Description className="sr-only">
            {t('Trò chuyện vài câu để AI điều chỉnh hành trình này theo chuyến đi của bạn. Bạn xem lại từng thay đổi trước khi lưu.')}
          </DialogPrimitive.Description>

          {/* The chat. */}
          <section
            aria-label={t('Sao chép bằng AI')}
            className={cn(
              'flex min-h-0 flex-1 flex-col border-border lg:w-[25rem] lg:flex-none lg:border-r',
              pane === 'plan' && 'hidden lg:flex',
            )}
          >
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
              <DialogPrimitive.Title className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold">
                <Sparkles className="size-4 shrink-0 text-np-teal" aria-hidden />
                {t('Sao chép bằng AI')}
              </DialogPrimitive.Title>
              <button
                type="button"
                onClick={() => setPane('plan')}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground lg:hidden"
              >
                <Route className="size-4" aria-hidden />
                {t('Hành trình')}
              </button>
              <DialogPrimitive.Close
                disabled={create.isPending}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40"
              >
                <X className="size-5" />
                <span className="sr-only">{t('Đóng')}</span>
              </DialogPrimitive.Close>
            </header>

            <p className="shrink-0 border-b border-border px-6 py-3 text-center text-xs leading-relaxed text-muted-foreground">
              {t('AI chỉ dùng địa điểm, giá và giờ mở cửa có trong dữ liệu ChillnGo; chỗ nào thiếu sẽ ghi “chưa có dữ liệu”.')}
            </p>

            {options.isPending ? (
              <div className="flex-1 space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : !data ? (
              <p className="flex-1 p-4 text-sm text-destructive">{(options.error as Error | null)?.message}</p>
            ) : (
              <ol ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
                <AssistantMessage>
                  {t('Chào bạn! Mình sẽ điều chỉnh “{title}” cho chuyến đi của bạn. Cứ nhắn tự nhiên, hoặc chọn gợi ý bên dưới nhé.', { title: post.title })}
                </AssistantMessage>
                {!data.destination && (
                  <AssistantMessage>
                    {t('ChillnGo chưa có dữ liệu địa điểm cho nơi này, nên AI chỉ sắp xếp lại các điểm có sẵn trong hành trình gốc.')}
                  </AssistantMessage>
                )}
                {messages.map((m, i) =>
                  m.mine ? <UserMessage key={i}>{m.text}</UserMessage> : <AssistantMessage key={i}>{m.text}</AssistantMessage>,
                )}

                {create.isPending ? (
                  <li role="status" className="rounded-2xl border border-border px-4 py-5">
                    <ProgressiveFluxLoader
                      value={progress}
                      phases={STEPS.map((key, i) => ({ at: STEP_AT[i], label: t(key) }))}
                      ariaLabel={t('AI đang tạo bản nháp…')}
                      className="gap-4"
                      textClassName="text-base font-semibold text-foreground sm:text-lg"
                      barClassName="h-3"
                    />
                    <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                      {t('Thường mất từ 20 giây đến một phút. Đừng đóng cửa sổ này nhé.')}
                    </p>
                  </li>
                ) : (
                  <li className="space-y-3">
                    {/* The question asked, in bold, with its quick replies under it. */}
                    <p className="text-sm font-semibold leading-relaxed">{question(asking)}</p>
                    <div className="flex flex-wrap gap-2">
                      {chipsFor(asking, data).map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          aria-pressed={chip.onToggle ? chip.pressed : undefined}
                          onClick={() => (chip.onToggle ? chip.onToggle() : reply(chip.says ?? chip.label, chip.answers ?? {}))}
                          className={cn(
                            'inline-flex max-w-full items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm transition-colors',
                            chip.pressed
                              ? 'border-np-teal bg-np-teal/15 text-foreground'
                              : 'border-border text-foreground hover:border-foreground/40 hover:bg-np-well',
                          )}
                        >
                          {chip.pressed ? <Check className="size-4 shrink-0 text-np-teal" /> : <Plus className="size-4 shrink-0" />}
                          <span className="truncate">{chip.label}</span>
                        </button>
                      ))}
                      {asking === 'when' && (
                        <Input
                          type="date"
                          aria-label={t('Chọn ngày khác')}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => e.target.value && reply(formatShortDate(e.target.value), { startDate: e.target.value })}
                          className="h-11 w-auto rounded-full px-4 text-sm"
                        />
                      )}
                    </div>
                  </li>
                )}

                {create.isError && (
                  <li role="alert" className="text-sm text-destructive">
                    {(create.error as Error).message}
                  </li>
                )}
                {left === 0 && (
                  <li role="alert" className="text-sm text-destructive">
                    {t('Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại vào ngày mai nhé.')}
                  </li>
                )}
              </ol>
            )}

            <form
              className="shrink-0 px-4 pb-4"
              onSubmit={(e) => {
                e.preventDefault()
                reply(text)
                inputRef.current?.focus()
              }}
            >
              <div className="rounded-2xl border-2 border-border bg-np-well transition-colors focus-within:border-np-teal">
                <Input
                  ref={inputRef}
                  aria-label={t('Trả lời')}
                  maxLength={300}
                  placeholder={t('Ví dụ: 3 ngày, 4 người có trẻ em, 5 triệu')}
                  value={text}
                  disabled={create.isPending || !data}
                  onChange={(e) => setText(e.target.value)}
                  className="h-12 border-0 bg-transparent px-3.5 shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="px-1.5 text-xs text-muted-foreground">
                    {data && t('Còn {left}/{limit} lượt AI hôm nay.', { left, limit: data.dailyLimit })}
                  </span>
                  <button
                    type="submit"
                    disabled={create.isPending || !text.trim()}
                    aria-label={t('Gửi')}
                    className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-35"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* The journey being adapted, like a canvas beside the chat. */}
          <div
            ref={canvasRef}
            className={cn(
              'min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8 xl:flex xl:flex-col xl:overflow-hidden xl:pb-4',
              pane === 'chat' && 'hidden lg:block',
            )}
          >
            <div className="flex items-center gap-3 pt-4 lg:hidden">
              <button
                type="button"
                onClick={() => setPane('chat')}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm"
              >
                <MessageSquare className="size-4" aria-hidden />
                {t('Quay lại chat')}
              </button>
            </div>

            <header className="flex shrink-0 flex-col gap-4 pt-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-np-teal">{t('Hành trình gốc')}</p>
                <h2 className="mt-1 font-display text-[1.75rem] font-extrabold leading-8 tracking-tight">“{post.title}”</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('{n} ngày', { n: post.days.length })} · @{post.author.username}
                </p>
              </div>
              {createButton}
            </header>

            {/*
              Wide screens: the header stays put, the journey scrolls on its own
              and the map fills the height beside it, down to the bottom edge.
              Narrower: everything scrolls, the map above the journey.
            */}
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] xl:grid-rows-[minmax(0,1fr)]">
              <div className="xl:order-last xl:h-full">
                <MapPreview
                  days={post.days}
                  day={day || null}
                  onDayChange={(next) => pickDay(next ?? 0)}
                  className="h-64 w-full sm:h-80 xl:h-full"
                  label={t('Bản đồ tuyến đường của {title}', { title: post.title })}
                />
              </div>

              <div ref={journeyRef} className="min-w-0 space-y-8 xl:overflow-y-auto xl:pb-6 xl:pr-2">
                {/* What the chat has gathered; the rest takes its default. */}
                <section aria-label={t('Thông tin chuyến đi')} className="rounded-2xl border border-border px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h3 className="text-sm font-bold">{t('Thông tin chuyến đi')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('Đã có {done}/{total} mục', { done, total: slots.length })} ·{' '}
                      {t('Bấm “Tạo bản nháp” lúc nào cũng được: mục chưa trả lời sẽ dùng mặc định.')}
                    </p>
                  </div>
                  {/*
                    Every item as a step: the one being asked is active, answered
                    ones are checked and show their value; a default is not shown.
                  */}
                  <Stepper value={asking ? slots.indexOf(asking) + 1 : slots.length + 1} className="mt-4">
                    {slots.map((slot, i) => {
                      const answered = settled.includes(slot)
                      return (
                        <StepperItem key={slot} step={i + 1} completed={answered} className="relative flex-1 !flex-col">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <StepperIndicator />
                            <div className="min-w-0 space-y-0.5 px-1">
                              <StepperTitle
                                className={cn('text-xs', asking === slot ? 'text-foreground' : 'text-muted-foreground', answered && 'text-foreground')}
                              >
                                {t(LABELS[slot])}
                              </StepperTitle>
                              {answered && (
                                <StepperDescription className="line-clamp-3 break-words text-xs text-np-teal">{valueOf(slot, form)}</StepperDescription>
                              )}
                            </div>
                          </div>
                          {i < slots.length - 1 && (
                            <StepperSeparator className="absolute inset-x-0 left-[calc(50%+0.75rem+0.125rem)] top-3 -order-1 m-0 -translate-y-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
                          )}
                        </StepperItem>
                      )
                    })}
                  </Stepper>
                </section>

                <PillTabs
                  label={t('Chọn ngày để xem đường đi')}
                  value={day}
                  onChange={pickDay}
                  items={[
                    { value: 0, label: t('Tất cả') },
                    ...days.map((d) => ({
                      value: d.position,
                      label: t('Ngày {n}', { n: d.dayNumber }),
                      leading: <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(d.position) }} aria-hidden />,
                    })),
                  ]}
                  className="w-fit"
                />
                {shownDays.map((d) => (
                  <section key={d._id} aria-label={t('Ngày {n}', { n: d.dayNumber })}>
                    <h3 className="flex items-center gap-2 font-display text-xl font-extrabold">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: dayColor(d.position) }} aria-hidden />
                      {t('Ngày {n}', { n: d.dayNumber })}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{[d.title, formatLongDate(d.date)].filter(Boolean).join(' · ')}</p>
                    <ol className="mt-4 space-y-4">
                      {d.locations.map((loc, i) => (
                        <StopCard key={loc._id} stop={loc} order={i + 1} color={dayColor(d.position)} />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** A stop of the journey being adapted: photo, numbered name in its day's colour (as on the map), cost and the author's note. */
function StopCard({ stop, order, color }: { stop: TripLocation; order: number; color: string }) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-np-well sm:aspect-square sm:w-40 2xl:w-48">
        {stop.photoUrl ? (
          <img src={stop.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <MapPin className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <h4 className="font-display text-lg font-bold leading-snug">
            <span style={{ color }}>{order}.</span> {stop.name}
          </h4>
          {stop.estCost > 0 && <p className="shrink-0 font-display text-lg font-bold">{formatVnd(stop.estCost)}</p>}
        </div>
        {stop.address && <p className="mt-1 text-[13px] text-muted-foreground">{stop.address}</p>}
        {stop.note && <p className="mt-3 text-sm leading-relaxed">{stop.note}</p>}
      </div>
    </li>
  )
}
