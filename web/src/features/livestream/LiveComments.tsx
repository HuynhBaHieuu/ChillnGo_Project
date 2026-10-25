import { Ban, Loader2, MoreHorizontal, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LiveComment } from '@/services/livestream.service'
import { localeTag, t } from '@/i18n'

const COMMENT_MAX = 300

const time = { format: (date: Date) => new Intl.DateTimeFormat(localeTag(), { hour: '2-digit', minute: '2-digit' }).format(date) }

interface LiveCommentsProps {
  comments: LiveComment[]
  /** Resolves when the server accepted it; rejects with a message to show. */
  onSend: (text: string) => Promise<void>
  /** Stream over, or signed out: read only. */
  disabled: boolean
  disabledReason?: string
  hostId: string
  /** The signed-in user, to offer "delete" on their own comments. */
  meId?: string
  /** Delete a comment: the host may delete any, others only their own. */
  onDelete?: (comment: LiveComment) => void
  /** Host only: remove this person from the stream. */
  onBlock?: (comment: LiveComment) => void
  className?: string
}

/** The chat beside (or, on phones, below) the video. New comments slide in at the bottom. */
export function LiveComments({
  comments,
  onSend,
  disabled,
  disabledReason,
  hostId,
  meId,
  onDelete,
  onBlock,
  className,
}: LiveCommentsProps) {
  const isHost = Boolean(meId) && meId === hostId
  const list = useRef<HTMLOListElement>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the newest comment in view, unless the reader scrolled up to read older ones.
  const pinned = useRef(true)
  useEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [comments.length])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    setError(null)
    try {
      await onSend(value)
      setText('')
      pinned.current = true
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      aria-label={t('Bình luận trực tiếp')}
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-foreground bg-card', className)}
    >
      <h2 className="border-b border-foreground/10 px-4 py-3 text-sm font-semibold">{t('Bình luận')}</h2>

      <ol
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {comments.length === 0 && (
          <li className="py-8 text-center text-xs text-muted-foreground">{t('Chưa có bình luận nào. Hãy là người đầu tiên!')}</li>
        )}
        {comments.map((c) => (
          <li key={c._id} className="animate-fade-rise group flex gap-2.5">
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={c.author.avatarUrl} alt="" />
              <AvatarFallback>{c.author.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-sm leading-snug">
              <p>
                <span className="font-semibold">{c.author.displayName}</span>
                {c.author._id === hostId && (
                  <span className="ml-1.5 rounded-full bg-sunset/20 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                    {t('Người phát')}
                  </span>
                )}
                <time dateTime={c.createdAt} className="ml-1.5 text-[11px] text-muted-foreground">
                  {time.format(new Date(c.createdAt))}
                </time>
              </p>
              <p className="whitespace-pre-line break-words">{c.text}</p>
            </div>
            {(isHost || c.author._id === meId) && onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('Tuỳ chọn bình luận của {name}', { name: c.author.displayName })}
                    className="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onDelete(c)}>
                    <Trash2 />
                    {t('Xoá bình luận')}
                  </DropdownMenuItem>
                  {isHost && onBlock && c.author._id !== hostId && (
                    <DropdownMenuItem onSelect={() => onBlock(c)} className="text-destructive focus:text-destructive">
                      <Ban />
                      {t('Chặn {name}', { name: c.author.displayName })}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} className="space-y-1.5 border-t border-foreground/10 p-3">
        {disabled ? (
          <p className="py-1.5 text-center text-xs text-muted-foreground">{disabledReason}</p>
        ) : (
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={COMMENT_MAX}
              aria-label={t('Viết bình luận')}
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" disabled={!text.trim() || sending} aria-label={t('Gửi bình luận')}>
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
