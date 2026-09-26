import { Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'

import { formatClock, useElapsed } from '@/features/livestream/live-format'
import type { DvrMode } from '@/features/livestream/useDvr'
import { cn } from '@/lib/utils'

/** The recording trails live by roughly this much: aiming closer means "live". */
const LIVE_MARGIN_SEC = 12
/** A drag or a run of arrow-key presses settles for this long before the player jumps. */
const SETTLE_MS = 350

interface DvrBarProps {
  /** The live clock: `baseSec` seconds since the start, measured at `baseAt` (see useElapsed). */
  baseSec: number
  baseAt: number
  mode: DvrMode
  loading: boolean
  paused: boolean
  /** Where the rewound picture is (dvr mode). */
  position: number
  /** How far the recording reaches (dvr mode, once known). */
  availableEnd: number | null
  onRewind: (elapsed: number) => void
  onGoLive: () => void
  onTogglePause: () => void
}

/**
 * The timeline under a live video for viewers: drag back to rewind, press
 * "Trực tiếp" to return. The full width is the time since the stream began.
 */
export function DvrBar({ baseSec, baseAt, mode, loading, paused, position, availableEnd, onRewind, onGoLive, onTogglePause }: DvrBarProps) {
  const elapsed = useElapsed(baseSec, baseAt)
  const total = Math.max(1, Math.floor(elapsed))
  const [scrub, setScrub] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const shown = scrub ?? (mode === 'live' ? total : Math.min(position, total))
  const reach = availableEnd ?? Math.max(0, total - LIVE_MARGIN_SEC)
  const behind = Math.max(0, total - shown)

  function commit(value: number) {
    setScrub(null)
    if (value >= total - LIVE_MARGIN_SEC / 2) {
      if (mode === 'dvr') onGoLive()
      return
    }
    onRewind(value)
  }

  function change(value: number) {
    setScrub(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => commit(value), SETTLE_MS)
  }

  const reachPct = Math.min(100, (reach / total) * 100)
  const shownPct = Math.min(100, (shown / total) * 100)

  return (
    <div className="flex items-center gap-2 text-white">
      <button
        type="button"
        onClick={() => onRewind((mode === 'dvr' ? position : total - LIVE_MARGIN_SEC) - 10)}
        aria-label="Tua lại 10 giây"
        title="Tua lại 10 giây"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-black/40 hover:bg-black/60"
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>

      {mode === 'dvr' && (
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={paused ? 'Phát' : 'Tạm dừng'}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-black/40 hover:bg-black/60"
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
      )}

      <div className="relative flex h-9 min-w-0 flex-1 items-center">
        {/* Track: recorded part, the few seconds not uploaded yet, what has been watched. */}
        <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${reachPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-rose-500" style={{ width: `${shownPct}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={Math.round(shown)}
          onChange={(e) => change(Number(e.target.value))}
          aria-label="Tua thời gian livestream"
          aria-valuetext={mode === 'live' && scrub === null ? `Trực tiếp, đã phát ${formatClock(total)}` : `${formatClock(shown)} trên ${formatClock(total)}`}
          className="dvr-range relative w-full"
        />
      </div>

      <span className="shrink-0 text-xs font-semibold tabular-nums" aria-hidden>
        {mode === 'live' && scrub === null ? formatClock(total) : `-${formatClock(behind)}`}
      </span>

      <button
        type="button"
        onClick={onGoLive}
        disabled={mode === 'live'}
        aria-label={mode === 'live' ? 'Đang xem trực tiếp' : 'Về trực tiếp'}
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold uppercase tracking-wider',
          mode === 'live' ? 'bg-rose-600 text-white' : 'bg-white/90 text-foreground hover:bg-white',
        )}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <span className={cn('size-2 rounded-full', mode === 'live' ? 'bg-white' : 'bg-rose-600')} aria-hidden />
        )}
        Trực tiếp
      </button>
    </div>
  )
}
