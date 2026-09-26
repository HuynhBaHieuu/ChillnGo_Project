import { useCallback, useEffect, useRef, useState } from 'react'

import { REACTION_KINDS } from '@/services/livestream.service'
import type { Livestream, ReactionKind } from '@/services/livestream.service'

export const REACTIONS: Record<ReactionKind, { emoji: string; label: string }> = {
  heart: { emoji: '❤️', label: 'Thả tim' },
  fire: { emoji: '🔥', label: 'Cháy quá' },
  clap: { emoji: '👏', label: 'Vỗ tay' },
  wow: { emoji: '😮', label: 'Wow' },
  haha: { emoji: '😂', label: 'Haha' },
}

/** 1234 → "1,2 N" (Vietnamese compact notation). */
export function compact(n: number): string {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** 3725 → "1 giờ 2 phút", 185 → "3 phút 5 giây". */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h) return m ? `${h} giờ ${m} phút` : `${h} giờ`
  if (m) return s ? `${m} phút ${s} giây` : `${m} phút`
  return `${s} giây`
}

/** A running time: 754 → "12:34", 3725 → "1:02:05". */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * Seconds a stream has been live, ticking every second. It counts on from
 * `baseSec` measured at `baseAt` (a local timestamp): pass the server's
 * durationSec and when it was fetched, so a wrong clock on this device does
 * not show a wrong time.
 */
export function useElapsed(baseSec: number, baseAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    // Tick right when the displayed second changes, so every clock on the page agrees.
    let timer: number
    const schedule = () => {
      const ms = baseSec * 1000 + Date.now() - baseAt
      timer = window.setTimeout(() => {
        setNow(Date.now())
        schedule()
      }, 1000 - (((ms % 1000) + 1000) % 1000) + 5)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [baseSec, baseAt])
  return Math.max(0, baseSec + (now - baseAt) / 1000)
}

const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** "18:01, 26/09/2026". (vi-VN's long style adds its own "lúc", which reads badly after "phát lúc".) */
export function formatStart(iso: string): string {
  const date = new Date(iso)
  return `${clock.format(date)}, ${day.format(date)}`
}

export function totalReactions(reactions: Livestream['reactions']): number {
  return REACTION_KINDS.reduce((sum, kind) => sum + reactions[kind], 0)
}

export interface Float {
  id: number
  kind: ReactionKind
  /** Horizontal sway, px. */
  drift: number
  /** Start offset from the right edge, px. */
  offset: number
}

/** More than this on screen at once and the oldest go: a flood stays readable. */
const MAX_FLOATS = 40

/** Reactions rising over the video. `add` shows `count` of them (a few at most per call). */
export function useFloatingReactions() {
  const [floats, setFloats] = useState<Float[]>([])
  const nextId = useRef(0)

  const add = useCallback((kind: ReactionKind, count = 1) => {
    const fresh = Array.from({ length: Math.min(count, 5) }, () => ({
      id: ++nextId.current,
      kind,
      drift: Math.round((Math.random() - 0.5) * 80),
      offset: Math.round(Math.random() * 36),
    }))
    setFloats((current) => [...current, ...fresh].slice(-MAX_FLOATS))
  }, [])

  const done = useCallback((id: number) => setFloats((current) => current.filter((f) => f.id !== id)), [])
  return { floats, add, done }
}
