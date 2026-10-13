/**
 * Decides which gesture the robot makes, and when, from what is happening in
 * the conversation, and mixes the running gestures into one set of offsets.
 *
 * It reacts to events (the reader typing, a question being thought over, a
 * reply starting with a given intent, each sentence of the reply arriving, the
 * reply ending) rather than looping animations, and it holds back: cooldowns
 * between gestures, a chance of doing nothing, no gesture straight after the
 * same one, and near-stillness while it waits.
 *
 * Gestures that only move the head (nods, tilts, glances) can play over one
 * that moves the arms (a nod while its hands are behind its back). A new arm gesture
 * fades out the arm gesture before it.
 */

import type { AssistantIntent } from '@/services/assistant.service'

import type { RobotMood } from '../robotMood'

import { GESTURES, sampleGesture } from './gestures'
import type { Gesture, GestureName } from './gestures'
import { addPatch, restPose } from './pose'
import type { FullPose } from './pose'

/** Which gesture opens a reply, by what the reply is doing. */
const OPENER: Record<AssistantIntent, GestureName> = {
  greet: 'wave',
  explain: 'openPalms',
  agree: 'nod',
  disagree: 'headShake',
  uncertain: 'tiltCurious',
  celebrate: 'cheer',
  thanks: 'cheeks',
}

/** Gestures that may land on a sentence, by what the reply is doing. */
const BEATS: Record<AssistantIntent | 'none', GestureName[]> = {
  explain: ['beatR', 'beatL', 'beatBoth', 'palmUp', 'nodSmall'],
  agree: ['nodSmall', 'beatR', 'palmUp'],
  disagree: ['raiseHand', 'beatL', 'nodSmall'],
  uncertain: ['palmUp', 'nodSmall', 'beatL'],
  greet: ['palmUp', 'beatR', 'nodSmall'],
  celebrate: ['beatR', 'beatBoth', 'nodSmall'],
  thanks: ['nodSmall', 'palmUp'],
  none: ['beatR', 'beatL', 'nodSmall', 'palmUp'],
}

/** How a reply's end is acknowledged (the face flashes too). Nothing for an ordinary answer half the time. */
const ENDING: Partial<Record<RobotMood, GestureName>> = {
  success: 'nodSmall',
  happy: 'wave',
  love: 'cheeks',
  confused: 'scratchHead',
  error: 'apologize',
  surprised: 'startle',
}

const HEAD_ONLY = new Set(['head', 'spine'])
const touchesArms = (g: Gesture) => g.keys.some(([, patch]) => Object.keys(patch).some((bone) => !HEAD_ONLY.has(bone)))
const FADE = 0.35

interface Playing {
  name: GestureName
  gesture: Gesture
  start: number
  /** Held gestures: when they were let go. */
  releasedAt?: number
  /** Interrupted: fading out from this moment. */
  fadingAt?: number
}

export interface DirectorFrame {
  /** To add onto the posture. */
  offsets: FullPose
  /** A face the current gesture asks for, if any. */
  face: RobotMood | null
  gaze: { x: number; y: number }
}

export class GestureDirector {
  private playing: Playing[] = []
  private recent: { name: GestureName; at: number }[] = []
  private mood: RobotMood = 'idle'
  private moodAt = 0
  private intent: AssistantIntent | null = null
  private nextBeatAt = 0
  private nextIdleAt = 6
  private nextListenAt = 0
  private pending: { name: GestureName; at: number; mood: RobotMood } | null = null
  private lastBeat: GestureName | null = null
  private settled = false

  private readonly calm: boolean
  private readonly random: () => number

  /** `calm` (reduced motion): only the gestures that mean something, none of the fidgeting. */
  constructor(calm = false, random = Math.random) {
    this.calm = calm
    this.random = random
  }

  setMood(mood: RobotMood, now: number) {
    if (mood === this.mood) return
    const previous = this.mood
    this.mood = mood
    this.moodAt = now
    if (this.pending && this.pending.mood !== mood) this.pending = null
    if (previous === 'thinking') this.releaseHeld(now)

    switch (mood) {
      case 'listening':
        this.nextListenAt = now + 1.2 + this.random() * 1.2
        break
      case 'thinking':
        // Only if the answer is not instant: short thinks pass without a gesture.
        this.pending = { name: 'thinkChin', at: now + 0.45, mood }
        this.settled = false
        break
      case 'speaking':
        this.nextBeatAt = Math.max(this.nextBeatAt, now + 1)
        break
      case 'idle':
        this.nextIdleAt = now + 7 + this.random() * 6
        break
      case 'sleepy':
        this.playing.forEach((p) => (p.fadingAt ??= now))
        break
      default: {
        // A wave means hello: after good news it is a small nod instead.
        const ending = mood === 'happy' && this.intent === 'celebrate' ? 'nodSmall' : ENDING[mood]
        // An ordinary answer gets a nod only some of the time, and never the same gesture twice in a row.
        if (ending && !(mood === 'success' && this.random() < 0.4) && !this.playedWithin(ending, now, 12)) this.play(ending, now)
      }
    }
  }

  /** A reply started; `intent` is what it is doing (null when unknown). */
  startReply(intent: AssistantIntent | null, now: number) {
    this.intent = intent
    this.pending = null
    this.releaseHeld(now)
    const opener = intent ? OPENER[intent] : null
    // Explanations open with a gesture most of the time; other intents always say what they are.
    if (opener && !(intent === 'explain' && this.random() < 0.3)) this.play(opener, now)
    this.nextBeatAt = now + (opener ? GESTURES[opener].duration : 0) + 0.5
  }

  /** A sentence of the reply finished arriving. */
  sentence(now: number) {
    if (this.mood !== 'speaking' || this.calm || now < this.nextBeatAt || this.armsBusy(now)) return
    this.nextBeatAt = now + 1.6 + this.random() * 1.4
    if (this.random() < 0.35) return // a pause: not every sentence needs a gesture
    // Never the same move as the last beat, however long ago it was.
    const choices = BEATS[this.intent ?? 'none'].filter((name) => name !== this.lastBeat && !this.playedWithin(name, now, 3))
    if (!choices.length) return
    this.lastBeat = choices[Math.floor(this.random() * choices.length)]
    this.play(this.lastBeat, now)
  }

  frame(now: number): DirectorFrame {
    if (this.pending && now >= this.pending.at) {
      if (this.mood === this.pending.mood) this.play(this.pending.name, now)
      this.pending = null
    }

    if (!this.calm) this.fidget(now)

    const offsets = restPose()
    let face: RobotMood | null = null
    const gaze = { x: 0, y: 0 }
    this.playing = this.playing.filter((p) => {
      const { gesture } = p
      let progress = (now - p.start) / gesture.duration
      if (gesture.holdAt !== undefined) {
        progress = p.releasedAt === undefined ? Math.min(progress, gesture.holdAt) : gesture.holdAt + (now - p.releasedAt) / gesture.duration
      }
      const weight = p.fadingAt === undefined ? 1 : 1 - smooth(p.fadingAt, p.fadingAt + FADE, now)
      if (progress >= 1 || weight <= 0) return false
      addPatch(offsets, sampleGesture(gesture, progress, now - p.start), weight)
      if (gesture.face && progress > 0.05 && progress < 0.92 && weight > 0.5) face = gesture.face
      if (gesture.gaze) {
        const g = gesture.gaze(progress)
        gaze.x += g.x * weight
        gaze.y += g.y * weight
      }
      return true
    })
    return { offsets, face, gaze }
  }

  /** Small things it does on its own: nods while listening, a longer think, a glance while waiting. */
  private fidget(now: number) {
    if (this.mood === 'listening' && now > this.nextListenAt && !this.busy(now)) {
      // Mostly small nods, never the same move twice running.
      const pick: GestureName = this.random() < 0.65 ? 'nodSmall' : 'tiltListen'
      this.play(this.playedWithin(pick, now, 8) ? (pick === 'nodSmall' ? 'tiltListen' : 'nodSmall') : pick, now)
      this.nextListenAt = now + 2.6 + this.random() * 2.6
    }
    // Still thinking after a while: hands behind its back.
    if (this.mood === 'thinking' && !this.settled && now - this.moodAt > 4.5) {
      this.settled = true
      this.releaseHeld(now)
      this.play('handsBehind', now)
    }
    if (this.mood === 'idle' && now > this.nextIdleAt) {
      this.nextIdleAt = now + 9 + this.random() * 7
      if (!this.busy(now)) {
        const choices = (['lookAround', 'weightShift', 'lookAround'] as GestureName[]).filter((n) => !this.playedWithin(n, now, 20))
        this.play(choices[0] ?? 'weightShift', now)
      }
    }
  }

  /** The gestures playing now (not the ones fading out). */
  active(): GestureName[] {
    return this.playing.filter((p) => p.fadingAt === undefined).map((p) => p.name)
  }

  private play(name: GestureName, now: number) {
    const gesture = GESTURES[name]
    if (this.playing.some((p) => p.name === name && p.fadingAt === undefined)) return
    // A new arm gesture takes over from the arm gesture before it; head-only gestures layer on top.
    if (touchesArms(gesture)) {
      for (const p of this.playing) if (touchesArms(p.gesture) && p.fadingAt === undefined) p.fadingAt = now
    }
    this.playing.push({ name, gesture, start: now })
    this.recent = [...this.recent.filter((r) => now - r.at < 30), { name, at: now }]
  }

  private releaseHeld(now: number) {
    for (const p of this.playing) if (p.gesture.holdAt !== undefined && p.releasedAt === undefined) p.releasedAt = now
  }

  private busy(now: number) {
    return this.playing.some((p) => p.fadingAt === undefined && now - p.start < p.gesture.duration)
  }

  private armsBusy(now: number) {
    return this.playing.some((p) => p.fadingAt === undefined && touchesArms(p.gesture) && (p.gesture.holdAt !== undefined || now - p.start < p.gesture.duration * 0.8))
  }

  private playedWithin(name: GestureName, now: number, seconds: number) {
    return this.recent.some((r) => r.name === name && now - r.at < seconds)
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
