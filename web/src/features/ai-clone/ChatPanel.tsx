import { ArrowUp, Loader2, Plus, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { useAiChat } from '@/features/ai-clone/hooks'
import { cn } from '@/lib/utils'
import type { AiDraft } from '@/services/types'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'

interface ChatPanelProps {
  draft: AiDraft
  /** Another edit is being saved: wait for it. */
  busy: boolean
  /** The AI's opening message: what the draft is based on. */
  intro?: React.ReactNode
  className?: string
}

/** Requests people often make; a tap puts one in the box to send or edit, it does not spend a request. */
const SUGGESTIONS: MessageKey[] = [
  'Rẻ hơn một chút',
  'Thêm một quán ăn địa phương',
  'Thêm điểm trong nhà phòng khi mưa',
  'Bớt một điểm để đi thong thả hơn',
]

/**
 * Edit the draft in words. Each message is one AI request; the AI answers with
 * edits to the draft (shown in the diff at once) and a short reply. Fills its
 * column: messages scroll, the box stays at the bottom.
 */
export function ChatPanel({ draft, busy, intro, className }: ChatPanelProps) {
  const chat = useAiChat(draft._id)
  const [message, setMessage] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const closed = Boolean(draft.committedItineraryId)
  const disabled = closed || busy || chat.isPending || draft.callsLeft === 0

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [draft.chat.length, chat.isPending])

  /** Each message costs an AI request: a double Enter must not send it twice. */
  const sending = useRef(false)

  function send() {
    const text = message.trim()
    if (!text || disabled || sending.current) return
    sending.current = true
    setMessage('')
    chat.mutate(text, {
      // Give the text back so a failed message can be resent without retyping it.
      onError: () => setMessage((current) => current || text),
      onSettled: () => {
        sending.current = false
      },
    })
  }

  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label={t('Chỉnh lịch trình bằng lời')}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Sparkles className="size-4 text-np-teal" aria-hidden />
          {t('Chỉnh bằng lời')}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {draft.callsLeft}/{draft.dailyLimit}
        </span>
      </header>

      <ol ref={listRef} className="min-h-40 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
        <li className="text-center text-xs leading-relaxed text-muted-foreground">
          {t('Ví dụ: “Bỏ chợ đêm, thêm một quán cà phê sáng ngày 2”. AI chỉ chọn địa điểm có trong dữ liệu ChillnGo.')}
        </li>
        {intro && <AssistantMessage>{intro}</AssistantMessage>}
        {!intro && draft.chat.length === 0 && !chat.isPending && (
          <li className="py-6 text-center text-sm text-muted-foreground">{t('Chưa có tin nhắn nào.')}</li>
        )}
        {draft.chat.map((m, i) =>
          m.role === 'user' ? (
            <UserMessage key={`${m.at}-${i}`}>{m.content}</UserMessage>
          ) : (
            <AssistantMessage key={`${m.at}-${i}`}>{m.content}</AssistantMessage>
          ),
        )}
        {chat.isPending && (
          <>
            <UserMessage>{chat.variables}</UserMessage>
            <li className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-np-teal" />
              {t('AI đang sửa lịch trình…')}
            </li>
          </>
        )}
        {chat.isError && (
          <li role="alert" className="text-sm text-destructive">
            {(chat.error as Error).message}
          </li>
        )}
        {!closed && !chat.isPending && (
          <li className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setMessage(t(suggestion))
                  inputRef.current?.focus()
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm text-foreground transition-colors hover:border-foreground/40 hover:bg-np-well"
              >
                <Plus className="size-4" aria-hidden />
                {t(suggestion)}
              </button>
            ))}
          </li>
        )}
      </ol>

      <form
        className="shrink-0 px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="rounded-2xl border-2 border-border bg-np-well transition-colors focus-within:border-np-teal">
          <Textarea
            ref={inputRef}
            aria-label={t('Yêu cầu chỉnh sửa')}
            rows={2}
            maxLength={500}
            placeholder={closed ? t('Bản nháp đã được lưu.') : t('Bạn muốn đổi gì?')}
            value={message}
            disabled={closed}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            className="min-h-0 resize-none border-0 bg-transparent px-3.5 pt-3 shadow-none focus-visible:ring-0"
          />
          <div className="flex justify-end px-2 pb-2">
            <button
              type="submit"
              disabled={disabled || !message.trim()}
              aria-label={t('Gửi')}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-35"
            >
              {chat.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {t('Mỗi tin nhắn dùng một lượt AI · còn {left}/{limit} lượt hôm nay.', { left: draft.callsLeft, limit: draft.dailyLimit })}
        </p>
      </form>
    </section>
  )
}

/** The AI's words: plain text on the page, no bubble. */
export function AssistantMessage({ children }: { children: React.ReactNode }) {
  return <li className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{children}</li>
}

export function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-np-well px-4 py-3 text-sm leading-relaxed text-foreground ring-1 ring-border">
        {children}
      </p>
    </li>
  )
}
