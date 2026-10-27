import { Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAiChat } from '@/features/ai-clone/hooks'
import { cn } from '@/lib/utils'
import type { AiDraft } from '@/services/types'
import { t } from '@/i18n'

interface ChatPanelProps {
  draft: AiDraft
  /** Another edit is being saved: wait for it. */
  busy: boolean
}

/**
 * Edit the draft in words. Each message is one AI request; the AI answers with
 * edits to the draft (shown in the diff at once) and a short reply.
 */
export function ChatPanel({ draft, busy }: ChatPanelProps) {
  const chat = useAiChat(draft._id)
  const [message, setMessage] = useState('')
  const listRef = useRef<HTMLOListElement>(null)

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
    chat.mutate(text, {
      onSuccess: () => setMessage(''),
      onSettled: () => {
        sending.current = false
      },
    })
  }

  return (
    <GlassCard as="section" className="flex flex-col p-5" aria-label={t('Chỉnh lịch trình bằng lời')}>
      <h2 className="font-display text-xl">{t('Chỉnh bằng lời')}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t('Ví dụ: “Bỏ chợ đêm, thêm một quán cà phê sáng ngày 2”. AI chỉ chọn địa điểm có trong dữ liệu ChillnGo.')}
      </p>

      <ol ref={listRef} className="mt-4 max-h-[24rem] min-h-24 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {draft.chat.length === 0 && !chat.isPending && (
          <li className="py-6 text-center text-sm text-muted-foreground">{t('Chưa có tin nhắn nào.')}</li>
        )}
        {draft.chat.map((m, i) => (
          <Bubble key={`${m.at}-${i}`} mine={m.role === 'user'}>
            {m.content}
          </Bubble>
        ))}
        {chat.isPending && (
          <>
            <Bubble mine>{chat.variables}</Bubble>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('AI đang sửa lịch trình…')}
            </li>
          </>
        )}
        {chat.isError && (
          <li role="alert" className="text-sm text-destructive">
            {(chat.error as Error).message}
          </li>
        )}
      </ol>

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <Textarea
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
          className="min-h-0 resize-none"
        />
        <Button type="submit" size="icon" disabled={disabled || !message.trim()} aria-label={t('Gửi')}>
          {chat.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('Mỗi tin nhắn dùng một lượt AI · còn {left}/{limit} lượt hôm nay.', { left: draft.callsLeft, limit: draft.dailyLimit })}
      </p>
    </GlassCard>
  )
}

export function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex', mine && 'justify-end')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          mine ? 'bg-primary text-primary-foreground' : 'bg-np-well text-foreground',
        )}
      >
        {children}
      </p>
    </li>
  )
}
