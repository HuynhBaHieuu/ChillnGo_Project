import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAiCloneOptions, useCreateAiDraft } from '@/features/ai-clone/hooks'
import { formatVnd } from '@/lib/format'
import type { AiPace, TripPostWithAuthor } from '@/services/types'

interface AiCloneDialogProps {
  post: TripPostWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PACES: { value: AiPace; label: string }[] = [
  { value: 'relaxed', label: 'Thong thả' },
  { value: 'moderate', label: 'Vừa phải' },
  { value: 'packed', label: 'Dày đặc' },
]

/** Shown in turn while the AI works, so a minute of waiting says what is happening. */
const STEPS = [
  'Đang đọc hành trình gốc…',
  'Đang chọn địa điểm từ dữ liệu ChillnGo…',
  'Đang xếp giờ cho từng ngày…',
  'Đang kiểm tra chi phí và giờ giấc…',
]

function nextWeek(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
}

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

/** Digits only: "5.000.000" and "5,000,000" both read as 5000000. */
function digits(value: string): number | null {
  const clean = value.replace(/\D/g, '')
  return clean ? Number(clean) : null
}

/**
 * The AI clone form: your dates, group, budget, interests and pace. The AI
 * adapts the journey to them and the result opens as a draft to review.
 */
export function AiCloneDialog({ post, open, onOpenChange }: AiCloneDialogProps) {
  const options = useAiCloneOptions(post._id, open)
  const create = useCreateAiDraft(post._id)
  const navigate = useNavigate()

  const [startDate, setStartDate] = useState(nextWeek)
  const [days, setDays] = useState(String(post.days.length))
  const [groupSize, setGroupSize] = useState('2')
  const [withChildren, setWithChildren] = useState(false)
  const [withElderly, setWithElderly] = useState(false)
  const [budget, setBudget] = useState('')
  const [departure, setDeparture] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [pace, setPace] = useState<AiPace>('moderate')
  const [mergeWith, setMergeWith] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  // A fresh form each time it opens (the same render-time reset as CloneDialog).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStartDate(nextWeek())
      setDays(String(post.days.length))
      setMergeWith([])
      setFormError(null)
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

  const left = options.data?.callsLeft ?? 0
  const budgetValue = digits(budget)

  /** What ChillnGo's season data says about the chosen dates; nothing without data. */
  const season = options.data?.season
  const months = monthsOf(startDate, Number(days))
  const seasonNotes = season
    ? [
        months.some((m) => season.rainyMonths.includes(m)) &&
          `Theo dữ liệu ChillnGo, ${options.data?.destination} đang vào mùa mưa: AI sẽ ưu tiên điểm trong nhà.`,
        months.some((m) => season.peakMonths.includes(m)) && 'Đang mùa cao điểm: nên đặt phòng và vé sớm.',
        ...season.festivals.filter((f) => months.includes(f.month)).map((f) => `Có ${f.name} (tháng ${f.month}).`),
      ].filter((note): note is string => Boolean(note))
    : []

  function toggleMerge(postId: string) {
    setMergeWith((current) =>
      current.includes(postId) ? current.filter((id) => id !== postId) : current.length < 2 ? [...current, postId] : current,
    )
  }

  /** Each draft costs an AI request: a double click must not start two. */
  const submitting = useRef(false)

  function handleSubmit() {
    if (submitting.current) return
    const dayCount = Number(days)
    const people = Number(groupSize)
    if (!startDate) return setFormError('Hãy chọn ngày khởi hành.')
    if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 14) return setFormError('Số ngày từ 1 đến 14.')
    if (!Number.isInteger(people) || people < 1 || people > 30) return setFormError('Số người từ 1 đến 30.')
    setFormError(null)
    setStep(0)
    submitting.current = true
    create.mutate(
      {
        form: {
          startDate,
          days: dayCount,
          groupSize: people,
          withChildren,
          withElderly,
          budget: budgetValue,
          departure: departure.trim(),
          interests,
          pace,
        },
        mergeWith,
      },
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
      title="Clone với AI"
      description="AI điều chỉnh hành trình này theo ngày đi, số người, ngân sách và sở thích của bạn. Bạn xem lại từng thay đổi trước khi lưu."
      className="max-w-xl"
      footer={
        create.isPending ? null : (
          <>
            <Button variant="ghost" onClick={close}>
              Huỷ
            </Button>
            <GlassButton tone="sunset" onClick={handleSubmit} disabled={!options.data || left === 0}>
              <Sparkles />
              {mergeWith.length ? 'Gộp và tạo bản nháp' : 'Tạo bản nháp'}
            </GlassButton>
          </>
        )
      }
    >
      {create.isPending ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-display text-lg">{STEPS[step]}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Thường mất từ 20 giây đến một phút. Đừng đóng cửa sổ này nhé.
          </p>
        </div>
      ) : options.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : options.isError ? (
        <p className="text-sm text-destructive">{(options.error as Error).message}</p>
      ) : (
        <div className="space-y-5">
          {!options.data.destination && (
            <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
              ChillnGo chưa có dữ liệu địa điểm cho nơi này, nên AI chỉ sắp xếp lại các điểm có sẵn trong hành trình gốc.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="ai-start">Ngày khởi hành</Label>
              <Input id="ai-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-days">Số ngày</Label>
              <Input id="ai-days" type="number" min={1} max={14} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-people">Số người</Label>
              <Input id="ai-people" type="number" min={1} max={30} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withChildren} onCheckedChange={(v) => setWithChildren(v === true)} />
              Có trẻ em
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withElderly} onCheckedChange={(v) => setWithElderly(v === true)} />
              Có người lớn tuổi
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-budget">Tổng ngân sách (cả nhóm)</Label>
              <Input
                id="ai-budget"
                inputMode="numeric"
                placeholder="Không bắt buộc"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              {budgetValue !== null && <p className="text-xs text-muted-foreground">{formatVnd(budgetValue)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-from">Điểm xuất phát</Label>
              <Input
                id="ai-from"
                placeholder="Ví dụ: TP.HCM"
                maxLength={100}
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
            </div>
          </div>

          {options.data.interests.length > 0 && (
            <div className="space-y-2">
              <Label>Sở thích</Label>
              <ToggleGroup
                type="multiple"
                aria-label="Sở thích"
                value={interests}
                onValueChange={setInterests}
                className="flex flex-wrap justify-start rounded-2xl"
              >
                {options.data.interests.map((interest) => (
                  <ToggleGroupItem key={interest.value} value={interest.value}>
                    {interest.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nhịp độ</Label>
            <ToggleGroup
              type="single"
              aria-label="Nhịp độ"
              value={pace}
              onValueChange={(v) => v && setPace(v as AiPace)}
              className="flex w-fit"
            >
              {PACES.map((p) => (
                <ToggleGroupItem key={p.value} value={p.value}>
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {seasonNotes.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-border p-3 text-sm text-muted-foreground">
              {seasonNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          {options.data.mergeable.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Gộp thêm hành trình cùng điểm đến (tối đa 2)</legend>
              <p className="text-xs text-muted-foreground">
                AI lấy những điểm hay nhất của các hành trình và gộp thành một lịch trình.
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {options.data.mergeable.map((journey) => {
                  const checked = mergeWith.includes(journey.postId)
                  return (
                    <li key={journey.postId}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-white/5">
                        <Checkbox
                          checked={checked}
                          disabled={!checked && mergeWith.length >= 2}
                          onCheckedChange={() => toggleMerge(journey.postId)}
                        />
                        <span className="min-w-0 flex-1 truncate">{journey.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {journey.days} ngày{journey.author && ` · @${journey.author}`}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            AI chỉ dùng địa điểm, giá và giờ mở cửa có trong dữ liệu ChillnGo; chỗ nào thiếu sẽ ghi “chưa có dữ liệu”.
            Còn {left}/{options.data.dailyLimit} lượt AI hôm nay.
          </p>

          {left === 0 && (
            <p role="alert" className="text-sm text-destructive">
              Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại vào ngày mai nhé.
            </p>
          )}

          {(formError || create.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {formError ?? (create.error as Error).message}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
