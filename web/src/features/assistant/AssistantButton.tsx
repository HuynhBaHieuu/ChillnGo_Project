import * as Popover from '@radix-ui/react-popover'
import { Loader2, Send, Square, X } from 'lucide-react'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { isTalking, useAssistantStore } from './assistant.store'
import { parseReply } from './replyTags'
import { RobotFace } from './RobotFace'
import { useRobotMood } from './robotMood'

/** Loaded the first time the chat opens: it brings three.js with it. */
const AssistantRobot = lazy(() => import('./AssistantRobot'))

const SUGGESTIONS = [
  'Gợi ý lịch trình 3 ngày ở Đà Lạt',
  'Đi Hà Giang mùa nào đẹp nhất?',
  'Cần chuẩn bị gì khi đi biển Phú Quốc?',
]

const QUESTION_MAX = 4000
/** A gesture cue fires this many characters before its word, so the gesture's stroke lands as the word appears. */
const CUE_LEAD = 18

/**
 * The AI travel assistant, in the bottom-right corner. Closed, it is the
 * robot's flat blinking face. Open, the 3D robot pops out there and the chat
 * appears beside it as a speech bubble pointing at its head: to its left on
 * wide screens, above it on phones (where it also clears the bottom nav).
 * Signed-in users only.
 */
export function AssistantButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [petting, setPetting] = useState(false)
  const { mood, poke, greet } = useRobotMood({ typing: text.trim().length > 0, petting })
  // The reply being said, for the robot's gestures: which one, what it is doing, and which of its cues are due.
  const reply = useAssistantStore((s) => {
    const last = s.messages.at(-1)
    return isTalking(s) && last?.role === 'assistant' ? last : null
  })
  const spoken = useAssistantStore((s) => s.spoken)
  const parsed = useMemo(() => (reply ? parseReply(reply.content) : null), [reply])
  // Known once the opening tag is in, or the text has started without one.
  const intent = parsed && (parsed.intent || parsed.text) ? parsed.intent : undefined
  const due = parsed ? parsed.cues.filter((cue) => cue.at <= spoken + CUE_LEAD).length : 0
  const wide = useMediaQuery('(min-width: 768px)')
  const launcher = useRef<HTMLButtonElement>(null)

  function type(value: string) {
    setText(value)
    poke()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'fixed z-50',
          open ? 'bottom-20 right-1 h-36 w-28 md:bottom-3 md:right-3 md:h-48 md:w-40' : 'bottom-24 right-4 w-16 md:bottom-6 md:right-6',
        )}
      >
        {/* Where the bubble's arrow points: the robot's screen face, not the empty canvas around it. */}
        <Popover.Anchor className="pointer-events-none absolute left-[20%] right-[22%] top-[15%] h-[30%]" />
        {open ? (
          <button
            type="button"
            aria-label="Đóng trợ lý du lịch"
            data-mood={mood}
            onClick={() => {
              setOpen(false)
              setPetting(false)
            }}
            // Move, not enter: the robot appears right under the pointer that just clicked the
            // launcher, and browsers send no enter event for an element that appears under it.
            onPointerMove={() => {
              setPetting(true)
              poke()
            }}
            onPointerLeave={() => setPetting(false)}
            // No CSS scale animation here: the canvas and the bubble's anchor are measured from this
            // box, and a mid-animation measurement left the robot shrunken. The robot pops in in 3D.
            className="size-full drop-shadow-[0_14px_16px_rgba(0,0,0,0.55)] animate-in fade-in-0 duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Suspense fallback={<RobotFace mood={mood} className="mx-auto mt-[22%] w-3/4" />}>
              <AssistantRobot mood={mood} replyId={reply?.id ?? null} intent={intent} cues={parsed?.cues ?? NO_CUES} due={due} onReady={greet} />
            </Suspense>
          </button>
        ) : (
          <button
            ref={launcher}
            type="button"
            aria-label="Trợ lý du lịch AI"
            onClick={() => {
              setOpen(true)
              poke()
            }}
            className="w-full rounded-[1.1rem] drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RobotFace blink />
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          side={wide ? 'left' : 'top'}
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Trợ lý du lịch"
          // A chat stays open while the reader scrolls or clicks around the page; Escape or ✕ closes it.
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // The launcher is back on screen only after this render.
            setTimeout(() => launcher.current?.focus())
          }}
          className="np-overlay z-50 flex h-[min(34rem,calc(100dvh-16rem))] border-[hsl(var(--np-beige)/0.22)] w-[min(23rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-3xl p-5 animate-in fade-in-0 zoom-in-95 duration-200 md:h-[min(34rem,calc(100dvh-8rem))]"
        >
          <AssistantChat text={text} setText={type} onClose={() => setOpen(false)} />
          {/* The tail shares the bubble's outline. It overlaps the bubble's border by 1px and
              skips stroking its base (the first 30 units of Radix's 30×10 triangle), so the two read as one shape. */}
          <Popover.Arrow
            width={28}
            height={15}
            strokeDasharray="0 30 37"
            className="-translate-y-px fill-[hsl(var(--np-surface))] stroke-[hsl(var(--np-beige)/0.22)]"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface AssistantChatProps {
  /** Owned by the parent: the robot listens while there is a draft, and typing wakes it. */
  text: string
  setText: (value: string) => void
  onClose: () => void
}

function AssistantChat({ text, setText, onClose }: AssistantChatProps) {
  const { messages, busy, error, spoken, send, stop, clear } = useAssistantStore()
  const talking = useAssistantStore(isTalking)
  const list = useRef<HTMLOListElement>(null)
  // What each message shows: replies without their gesture tags, the one being said only as far as it has got.
  const shown = messages.map((message, i) => {
    if (message.role === 'user') return message.content
    const reply = parseReply(message.content).text
    return talking && i === messages.length - 1 ? reply.slice(0, wordEnd(reply, spoken)) : reply
  })

  // Follow the answer as it is said, unless the reader scrolled up to read.
  const pinned = useRef(true)
  const lastShown = shown.at(-1)
  useEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages.length, lastShown])

  async function ask(question: string) {
    const value = question.trim()
    if (!value || busy) return
    setText('')
    pinned.current = true
    // Not answered (error, quota): give the question back so it can be sent again.
    if (!(await send(value))) setText(value)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void ask(text)
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl tracking-tight">Trợ lý du lịch</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Hỏi về điểm đến, lịch trình hay cách chuẩn bị. Câu trả lời do AI tạo nên có thể chưa chính xác.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="-mr-1.5 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2">
          <p className="text-sm text-muted-foreground">Thử hỏi:</p>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              className="rounded-xl border border-foreground/15 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <ol
          ref={list}
          onScroll={(e) => {
            const el = e.currentTarget
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          }}
          aria-live="polite"
          className="-mx-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-2"
        >
          {messages.map((message, i) => (
            <li
              key={message.id}
              className={cn(
                'w-fit max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'ml-auto rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-white/[0.06]',
              )}
            >
              {shown[i] ? (
                plainText(shown[i])
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Đang soạn câu trả lời…
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-2">
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={QUESTION_MAX}
            placeholder="Hỏi về chuyến đi của bạn…"
            aria-label="Câu hỏi cho trợ lý"
            autoComplete="off"
          />
          {busy ? (
            <Button type="button" onClick={stop} size="icon" className="size-10 shrink-0 rounded-full" aria-label="Dừng trả lời">
              <Square aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" disabled={!text.trim()} aria-label="Gửi câu hỏi">
              <Send aria-hidden />
            </Button>
          )}
        </form>
        {messages.length > 0 && !busy && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Bắt đầu cuộc trò chuyện mới
          </button>
        )}
      </div>
    </>
  )
}

const NO_CUES: [] = []

/** Up to the end of the word at `n`: a reply being said shows whole words. */
function wordEnd(text: string, n: number) {
  if (n >= text.length) return text.length
  const from = Math.floor(n)
  const space = text.slice(from).search(/\s/)
  return space < 0 ? text.length : from + space
}

/**
 * Gemini still writes some Markdown despite being asked not to. Bold markers and
 * list stars read as noise in plain text, so they become plain words and bullets.
 */
// ponytail: no Markdown renderer; add one (with sanitising) if replies need tables or links.
function plainText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^(\s*)[*-] /gm, '$1• ')
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
  )
}
