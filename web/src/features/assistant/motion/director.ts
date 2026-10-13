/**
 * Decides which gesture the robot makes, and when, from what is happening in
 * the conversation, and mixes the running gestures into one set of offsets,
 * hand shapes and reach goals.
 *
 * It reacts to events (the reader typing, a question being thought over, a
 * reply starting with a given intent, the words the model marked as it says
 * them, the reply ending) rather than looping animations, and it holds back:
 * cooldowns between gestures, a chance of doing nothing, no gesture straight
 * after the same one, and near-stillness while it waits.
 *
 * Gestures that only move the head (nods, tilts, glances) can play over one
 * that moves the arms (a nod while the arms are folded). A new arm gesture
 * fades out the arm gesture before it.
 */

import type { AssistantIntent } from '../replyTags'

import type { Side } from '../robotArms'
import type { RobotMood } from '../robotMood'
import type { Cue } from '../replyTags'

import { GESTURES, presence, sampleGesture } from './gestures'
import type { Gesture, GestureName } from './gestures'
import { COUNT } from './hands'
import type { HandShapeName } from './hands'
import type { Reach } from './ik'
import { addPatch, restPose } from './pose'
import type { FullPose } from './pose'

/** Which gestures may open a reply, by what the reply is doing (one is picked). */
const OPENER: Record<AssistantIntent, GestureName[]> = {
  greet: ['wave'],
  explain: ['openPalms', 'palmUp'],
  agree: ['nod'],
  disagree: ['headShake'],
  uncertain: ['tiltCurious'],
  celebrate: ['cheer'],
  thanks: ['cheeks', 'handOnChest'],
}

/** Gestures that may land on a stressed word, by what the reply is doing. */
const BEATS: Record<AssistantIntent | 'none', GestureName[]> = {
  explain: ['beatR', 'beatL', 'pinchBeat', 'beatBoth', 'palmUp', 'nodSmall'],
  agree: ['nodSmall', 'beatR', 'palmUp'],
  disagree: ['raiseHand', 'beatL', 'nodSmall'],
  uncertain: ['palmUp', 'nodSmall', 'beatL'],
  greet: ['palmUp', 'beatR', 'nodSmall'],
  celebrate: ['beatR', 'beatBoth', 'nodSmall'],
  thanks: ['nodSmall', 'palmUp'],
  none: ['beatR', 'beatL', 'pinchBeat', 'nodSmall', 'palmUp'],
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

const SIDES: Side[] = ['L', 'R']
const FADE = 0.35
/** With no new number this long, the counting hand comes down. */
const COUNT_HOLD = 2.8

/** Which arms a gesture uses: in its keys, its hand shapes or its reach. */
const usesArm = new Map<Gesture, Record<Side, boolean>>()
function armsOf(g: Gesture): Record<Side, boolean> {
  let found = usesArm.get(g)
  if (!found) {
    const bones = new Set(g.keys.flatMap(([, patch]) => Object.keys(patch)))
    const side = (s: Side) => ['upperArm', 'foreArm', 'hand'].some((b) => bones.has(`${b}${s}`)) || Boolean(g.hands?.[s] || g.reach?.[s])
    found = { L: side('L'), R: side('R') }
    usesArm.set(g, found)
  }
  return found
}
const touchesArms = (g: Gesture) => armsOf(g).L || armsOf(g).R

interface Playing {
  name: GestureName
  gesture: Gesture
  start: number
  /** Held gestures: when they were let go. */
  releasedAt?: number
  /** Interrupted: fading out from this moment. */
  fadingAt?: number
  /** Hand shapes instead of the gesture's own (how many fingers it is counting). */
  hands?: Partial<Record<Side, HandShapeName>>
}

export interface DirectorFrame {
  /** To add onto the posture. */
  offsets: FullPose
  /** A face the current gesture asks for, if any. */
  face: RobotMood | null
  gaze: { x: number; y: number }
  /** Hand shapes the gestures ask for, in order, each to blend over the last by its weight. */
  hands: { side: Side; shape: HandShapeName; weight: number }[]
  /** Where IK should put each wrist, if anywhere. */
  reach: Partial<Record<Side, Reach>>
  /** 0–1 per arm: how much a gesture has it, so its posture gives way to the relaxed one the gestures are written for. */
  arms: Record<Side, number>
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
  /** The model marked stressed words in this reply: sentence ends no longer get beats of their own. */
  private stressed = false
  private countUntil = 0
  /** A thumbs-up or list point that came while the arm was busy, to do once it is free. */
  private waiting: { cue: Cue; at: number } | null = null
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
    if (previous === 'thinking' || previous === 'speaking') this.releaseHeld(now)

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
        this.nextBeatAt = Math.max(this.nextBeatAt, now + 0.4)
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
    this.stressed = false
    this.pending = null
    this.waiting = null
    this.releaseHeld(now)
    const choices = intent ? OPENER[intent] : []
    const opener = choices[Math.floor(this.random() * choices.length)]
    // Explanations open with a gesture most of the time; other intents always say what they are.
    const played = opener && !(intent === 'explain' && this.random() < 0.3)
    if (played) this.play(opener, now)
    // The first beat is not the opener over again.
    this.lastBeat = played ? opener : null
    // An arm opener keeps the arms busy anyway (armsBusy); this only spaces a beat after a nod.
    this.nextBeatAt = now + (played ? GESTURES[opener].duration * 0.6 : 0.4)
  }

  /** A marked word (or a sentence end) of the reply is being said. */
  cue(cue: Cue, now: number) {
    if (this.mood !== 'speaking' || this.calm) return
    switch (cue.kind) {
      case 'beat':
        this.stressed = true
        this.beat(now, true)
        break
      case 'sentence':
        if (!this.stressed) this.beat(now, false)
        break
      case 'thumbsup':
      case 'count': {
        // The arm is in the middle of another move: let it get there first (the newest such cue waits).
        const free = this.armFreeAt(cue, now)
        if (free > now) this.waiting = { cue, at: free }
        else this.handCue(cue, now)
        break
      }
    }
  }

  frame(now: number): DirectorFrame {
    if (this.pending && now >= this.pending.at) {
      if (this.mood === this.pending.mood) this.play(this.pending.name, now)
      this.pending = null
    }
    if (this.waiting && now >= this.waiting.at) {
      const { cue } = this.waiting
      this.waiting = null
      if (this.mood === 'speaking') this.handCue(cue, now)
    }
    if (now > this.countUntil) {
      for (const p of this.playing) if (p.name === 'count' && p.releasedAt === undefined) p.releasedAt = now
    }

    if (!this.calm) this.fidget(now)

    const offsets = restPose()
    let face: RobotMood | null = null
    const gaze = { x: 0, y: 0 }
    const hands: DirectorFrame['hands'] = []
    const reach: DirectorFrame['reach'] = {}
    const arms: Record<Side, number> = { L: 0, R: 0 }
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
      const there = presence(gesture, progress) * weight
      const used = armsOf(gesture)
      for (const side of SIDES) {
        if (used[side]) arms[side] = Math.max(arms[side], there)
        const shape = p.hands?.[side] ?? gesture.hands?.[side]
        if (shape) hands.push({ side, shape, weight: there })
        const goal = gesture.reach?.[side]
        if (goal && there > (reach[side]?.weight ?? 0)) reach[side] = { ...goal, weight: there }
      }
      return true
    })
    return { offsets, face, gaze, hands, reach, arms }
  }

  /**
   * Starts a gesture now (unless it is already playing). For the director's own
   * choices, and in development for trying one from the console:
   * `__assistantRobot.play('thumbsUp')`.
   */
  play(name: GestureName, now = performance.now() / 1000) {
    const gesture = GESTURES[name]
    if (this.playing.some((p) => p.name === name && p.fadingAt === undefined)) return
    // A new arm gesture takes over from the arm gesture before it; head-only gestures layer on top.
    if (touchesArms(gesture)) {
      for (const p of this.playing) if (touchesArms(p.gesture) && p.fadingAt === undefined) p.fadingAt = now
    }
    this.playing.push({ name, gesture, start: now })
    this.recent = [...this.recent.filter((r) => now - r.at < 30), { name, at: now }]
  }

  /** The gestures playing now (not the ones fading out). */
  active(): GestureName[] {
    return this.playing.filter((p) => p.fadingAt === undefined).map((p) => p.name)
  }

  /**
   * A gesture on a stressed word. `marked`: the model chose this word, so it is
   * usually taken; a sentence end (when the model marked nothing) only sometimes.
   */
  private beat(now: number, marked: boolean) {
    // Hands busy (counting, folded): a marked word still gets a nod; an unmarked one nothing.
    const handsBusy = this.armsBusy(now)
    if (now < this.nextBeatAt || (handsBusy && !marked)) return
    this.nextBeatAt = now + (marked ? 1.2 + this.random() * 0.8 : 1.6 + this.random() * 1.4)
    if (this.random() < (marked ? 0.15 : 0.35)) return // a pause: not every stress needs a gesture
    // Never the same move as the last beat, however long ago it was.
    const choices = (handsBusy ? (['nodSmall', 'nod'] as GestureName[]) : BEATS[this.intent ?? 'none']).filter(
      (name) => name !== this.lastBeat && !this.playedWithin(name, now, 3),
    )
    if (!choices.length) return
    this.lastBeat = choices[Math.floor(this.random() * choices.length)]
    this.play(this.lastBeat, now)
  }

  /**
   * When the arm will be free for a thumbs-up or a count: once the arm move under way is mostly done
   * (a held one, once it is up). The counting hand does not block the next number.
   */
  private armFreeAt(cue: Cue, now: number) {
    let free = now
    for (const p of this.playing) {
      if (p.fadingAt !== undefined || !touchesArms(p.gesture) || (cue.kind === 'count' && p.name === 'count')) continue
      const held = p.gesture.holdAt !== undefined && p.releasedAt === undefined
      free = Math.max(free, p.start + p.gesture.duration * (held ? p.gesture.holdAt! : 0.7))
    }
    return free
  }

  private handCue(cue: Cue, now: number) {
    if (cue.kind === 'count') this.count(cue.n, now)
    else if (!this.playedWithin('thumbsUp', now, 8)) this.play('thumbsUp', now)
  }

  /** Point `n` of a list: the counting hand comes up, or shows one more finger if it is already up. */
  private count(n: number, now: number) {
    const shape = COUNT[n - 1]
    if (!shape) return this.beat(now, true)
    let counting = this.playing.find((p) => p.name === 'count' && p.fadingAt === undefined)
    // Already on its way down: a fresh one comes up instead.
    if (counting?.releasedAt !== undefined) {
      counting.fadingAt = now
      counting = undefined
    }
    if (!counting) {
      this.play('count', now)
      counting = this.playing.find((p) => p.name === 'count' && p.fadingAt === undefined)
    }
    if (counting) counting.hands = { R: shape }
    this.countUntil = now + COUNT_HOLD
  }

  /** Small things it does on its own: nods while listening, a longer think, a glance while waiting. */
  private fidget(now: number) {
    if (this.mood === 'listening' && now > this.nextListenAt && !this.busy(now)) {
      // Mostly small nods, never the same move twice running.
      const pick: GestureName = this.random() < 0.65 ? 'nodSmall' : 'tiltListen'
      this.play(this.playedWithin(pick, now, 8) ? (pick === 'nodSmall' ? 'tiltListen' : 'nodSmall') : pick, now)
      this.nextListenAt = now + 2.6 + this.random() * 2.6
    }
    // Still thinking after a while: settles into folded arms, or hands behind its back.
    if (this.mood === 'thinking' && !this.settled && now - this.moodAt > 4.5) {
      this.settled = true
      this.releaseHeld(now)
      this.play(this.random() < 0.65 ? 'foldArms' : 'handsBehind', now)
    }
    if (this.mood === 'idle' && now > this.nextIdleAt) {
      this.nextIdleAt = now + 9 + this.random() * 7
      if (!this.busy(now)) {
        const choices = (['lookAround', 'weightShift', 'lookAround'] as GestureName[]).filter((n) => !this.playedWithin(n, now, 20))
        this.play(choices[0] ?? 'weightShift', now)
      }
    }
  }

  private releaseHeld(now: number) {
    for (const p of this.playing) if (p.gesture.holdAt !== undefined && p.releasedAt === undefined) p.releasedAt = now
  }

  private busy(now: number) {
    return this.playing.some((p) => p.fadingAt === undefined && now - p.start < p.gesture.duration)
  }

  private armsBusy(now: number) {
    return this.playing.some(
      (p) => p.fadingAt === undefined && touchesArms(p.gesture) && ((p.gesture.holdAt !== undefined && p.releasedAt === undefined) || now - p.start < p.gesture.duration * 0.8),
    )
  }

  private playedWithin(name: GestureName, now: number, seconds: number) {
    return this.recent.some((r) => r.name === name && now - r.at < seconds)
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
