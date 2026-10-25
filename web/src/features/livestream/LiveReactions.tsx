import { useCallback, useEffect, useRef, useState } from 'react'

import { REACTIONS, compact } from '@/features/livestream/live-format'
import type { Float } from '@/features/livestream/live-format'

import { cn } from '@/lib/utils'
import { ApiError, livestreamService } from '@/services'
import { REACTION_KINDS } from '@/services/livestream.service'
import type { ReactionKind } from '@/services/livestream.service'
import { t } from '@/i18n'

export function FloatingReactions({ floats, onDone }: { floats: Float[]; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute bottom-20 right-3 h-64 w-24" aria-hidden>
      {floats.map((f) => (
        <span
          key={f.id}
          onAnimationEnd={() => onDone(f.id)}
          className="animate-reaction-float absolute bottom-0 text-3xl drop-shadow"
          style={{ right: f.offset, ['--drift' as string]: `${f.drift}px` }}
        >
          {REACTIONS[f.kind].emoji}
        </span>
      ))}
    </div>
  )
}

/** Quick taps are bundled into one request per reaction, at most every half second. */
const FLUSH_MS = 500
const MAX_BUNDLE = 10

/**
 * The row of reaction buttons. Each tap shows the emoji right away (onTap);
 * the server gets the taps in bundles and sends them on to everyone else.
 */
export function ReactionBar({
  streamId,
  counts,
  onTap,
  className,
}: {
  streamId: string
  counts: Record<ReactionKind, number>
  onTap: (kind: ReactionKind) => void
  className?: string
}) {
  const pending = useRef<Partial<Record<ReactionKind, number>>>({})
  const timer = useRef<number | undefined>(undefined)
  const [note, setNote] = useState<string | null>(null)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const batch = pending.current
    pending.current = {}
    for (const kind of REACTION_KINDS) {
      const count = batch[kind]
      if (!count) continue
      livestreamService.sendReaction(streamId, kind, count).catch((error: unknown) => {
        const tooFast = error instanceof ApiError && error.code === 'REACTION_RATE_LIMIT'
        setNote(tooFast ? t('Bạn thả nhanh quá, nghỉ tay một chút nhé.') : (error as Error).message)
        window.setTimeout(() => setNote(null), 3000)
      })
    }
  }, [streamId])

  // Send whatever is still waiting when the page closes.
  useEffect(() => flush, [flush])

  function tap(kind: ReactionKind) {
    onTap(kind)
    const count = (pending.current[kind] ?? 0) + 1
    pending.current[kind] = count
    if (count >= MAX_BUNDLE) flush()
    else timer.current ??= window.setTimeout(flush, FLUSH_MS)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Thả cảm xúc')}>
        {REACTION_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => tap(kind)}
            aria-label={REACTIONS[kind].label}
            title={REACTIONS[kind].label}
            className="flex h-10 items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-3 text-lg shadow-[2px_2px_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            <span aria-hidden>{REACTIONS[kind].emoji}</span>
            {counts[kind] > 0 && <span className="text-xs font-semibold tabular-nums">{compact(counts[kind])}</span>}
          </button>
        ))}
      </div>
      {note && (
        <p role="status" className="text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}

