import { Check, Loader2, Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Bubble } from '@/features/ai-clone/ChatPanel'
import { nextWeek, parseReply, SKIP, SLOT_OF, thisWeekend } from '@/features/ai-clone/chatParse'
import type { Slot, TripAnswers } from '@/features/ai-clone/chatParse'
import { useAiCloneOptions, useCreateAiDraft } from '@/features/ai-clone/hooks'
import { t, translatedList, tx } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { formatShortDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AiCloneForm, AiCloneOptions, AiPace, TripPostWithAuthor } from '@/services/types'

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
  const [step, setStep] = useState(0)
  const listRef = useRef<HTMLOListElement>(null)

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
    }
  }

  /** Closing forgets a failed attempt, so it is not shown next time. */
  function close() {
    create.reset()
    onOpenChange(false)
  }

  useEffect(() => {
    if (!create.isPending) return
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 8000)
    return () => clearInterval(timer)
  }, [create.isPending])

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, create.isPending, create.isError])

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
      bot.push(question(slots.find((s) => !nextSettled.has(s)) ?? null))
    }

    setAnswers(nextAnswers)
    setSettled([...nextSettled])
    setMessages((m) => [...m, { mine: true, text: said }, ...bot.map((b) => ({ mine: false, text: b }))])
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
    setStep(0)
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

  return (
    <Modal
      open={open}
      // The AI is already working on it: closing now would only hide the result.
      onOpenChange={(next) => !next && !create.isPending && close()}
      title={t('Sao chép bằng AI')}
      description={t('Trò chuyện vài câu để AI điều chỉnh hành trình này theo chuyến đi của bạn. Bạn xem lại từng thay đổi trước khi lưu.')}
      className="max-w-4xl"
      footer={
        create.isPending ? null : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('Huỷ')}
            </Button>
            <GlassButton tone="sunset" onClick={handleSubmit} disabled={!data || left === 0}>
              <Sparkles />
              {mergeWith.length ? t('Gộp và tạo bản nháp') : t('Tạo bản nháp')}
            </GlassButton>
          </>
        )
      }
    >
      {options.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-destructive">{(options.error as Error | null)?.message}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="flex min-w-0 flex-col">
            <ol ref={listRef} className="h-[min(24rem,45vh)] space-y-3 overflow-y-auto pr-1" aria-live="polite">
              <Bubble mine={false}>
                {t('Chào bạn! Mình sẽ điều chỉnh “{title}” cho chuyến đi của bạn. Cứ nhắn tự nhiên, hoặc chọn gợi ý bên dưới nhé.', { title: post.title })}
              </Bubble>
              {!data.destination && (
                <Bubble mine={false}>
                  {t('ChillnGo chưa có dữ liệu địa điểm cho nơi này, nên AI chỉ sắp xếp lại các điểm có sẵn trong hành trình gốc.')}
                </Bubble>
              )}
              <Bubble mine={false}>{question(slots[0])}</Bubble>
              {messages.map((m, i) => (
                <Bubble key={i} mine={m.mine}>
                  {m.text}
                </Bubble>
              ))}
              {create.isPending && (
                <li role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {t(STEPS[step])} {t('Thường mất từ 20 giây đến một phút. Đừng đóng cửa sổ này nhé.')}
                </li>
              )}
              {create.isError && (
                <li role="alert" className="text-sm text-destructive">
                  {(create.error as Error).message}
                </li>
              )}
            </ol>

            {!create.isPending && (
              <div className="mt-3 flex flex-wrap gap-2">
                {chipsFor(asking, data).map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    aria-pressed={chip.onToggle ? chip.pressed : undefined}
                    onClick={() => (chip.onToggle ? chip.onToggle() : reply(chip.says ?? chip.label, chip.answers ?? {}))}
                    className={cn(
                      'max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      chip.pressed
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-white/10',
                    )}
                  >
                    {chip.pressed && <Check className="-ml-0.5 mr-1 inline size-3" />}
                    {chip.label}
                  </button>
                ))}
                {asking === 'when' && (
                  <Input
                    type="date"
                    aria-label={t('Chọn ngày khác')}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => e.target.value && reply(formatShortDate(e.target.value), { startDate: e.target.value })}
                    className="h-8 w-auto rounded-full text-xs"
                  />
                )}
              </div>
            )}

            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                reply(text)
              }}
            >
              <Input
                aria-label={t('Trả lời')}
                maxLength={300}
                placeholder={t('Ví dụ: 3 ngày, 4 người có trẻ em, 5 triệu')}
                value={text}
                disabled={create.isPending}
                onChange={(e) => setText(e.target.value)}
                className="rounded-full"
              />
              <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={create.isPending || !text.trim()} aria-label={t('Gửi')}>
                <Send />
              </Button>
            </form>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t('AI chỉ dùng địa điểm, giá và giờ mở cửa có trong dữ liệu ChillnGo; chỗ nào thiếu sẽ ghi “chưa có dữ liệu”.')}{' '}
              {t('Còn {left}/{limit} lượt AI hôm nay.', { left, limit: data.dailyLimit })}
            </p>
            {left === 0 && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {t('Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại vào ngày mai nhé.')}
              </p>
            )}
          </div>

          <aside className="hidden md:block" aria-label={t('Thông tin chuyến đi')}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('Thông tin chuyến đi')}</p>
            <p className="mt-1 font-display text-lg">
              {t('Đã có {done}/{total} mục', { done: slots.filter((s) => settled.includes(s)).length, total: slots.length })}
            </p>
            <ol className="mt-4 space-y-3">
              {slots.map((slot) => {
                const done = settled.includes(slot)
                return (
                  <li key={slot} className="flex gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                        done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                      )}
                    >
                      {done && <Check className="size-3" />}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="text-xs text-muted-foreground">{t(LABELS[slot])}</p>
                      <p className={cn('truncate', !done && 'text-muted-foreground')}>
                        {done ? valueOf(slot, form) : t('Mặc định: {value}', { value: valueOf(slot, form) })}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {t('Bấm “Tạo bản nháp” lúc nào cũng được: mục chưa trả lời sẽ dùng mặc định.')}
            </p>
          </aside>
        </div>
      )}
    </Modal>
  )
}
