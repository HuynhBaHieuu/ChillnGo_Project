/**
 * The robot's gestures: short movements laid on top of its posture.
 *
 * A gesture is a set of keyframes, offsets from the posture, eased between.
 * Each channel (bone × axis) has its own keys, so parts of one gesture start
 * and land at different moments (the shoulder leads, the head follows), and
 * every channel starts and ends at zero, so a gesture always hands back to
 * whatever posture is underneath. Several gestures (anticipation before a
 * raise, a hold, a settle) are spelled out as keys; the springs in springs.ts
 * add the weight and follow-through on top.
 */

import type { RobotMood } from '../robotMood'

import { mirror } from './pose'
import type { PosePatch } from './pose'

export interface Gesture {
  /** Seconds, start to finish. */
  duration: number
  /** [progress 0–1, offsets]. Channels not named at a key carry on between their own keys. */
  keys: [number, PosePatch][]
  /** Held gestures (thinking poses) stop at this progress until released, then finish. */
  holdAt?: number
  /** A movement on top of the keys, given seconds since start and progress (a wrist's wave). */
  wiggle?: (t: number, progress: number) => PosePatch
  /** The face to show while it plays. */
  face?: RobotMood
  /** Where the eyes look while it plays (screen units), given progress. */
  gaze?: (progress: number) => { x: number; y: number }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** 0 at the edges, 1 between `rise` and `fall`: for wiggles that should only run mid-gesture. */
const envelope = (p: number, rise: [number, number], fall: [number, number]) => smooth(rise[0], rise[1], p) * (1 - smooth(fall[0], fall[1], p))

// ── Agreeing, disagreeing, uncertainty ──────────────────────────────────────

const nod: Gesture = {
  duration: 1.05,
  keys: [
    [0.22, { head: { x: 0.2 }, spine: { x: 0.03 } }],
    [0.44, { head: { x: -0.03 } }],
    [0.64, { head: { x: 0.12 }, spine: { x: 0.01 } }],
    [0.84, { head: { x: 0.01 } }],
  ],
}

const nodSmall: Gesture = {
  duration: 0.95,
  keys: [
    [0.3, { head: { x: 0.1 } }],
    [0.58, { head: { x: 0.015 } }],
    [0.78, { head: { x: 0.055 } }],
  ],
}

/** While listening: the head tips and turns a little, then comes back. */
const tiltListen: Gesture = {
  duration: 1.9,
  keys: [
    [0.3, { head: { z: -0.11, y: 0.06 } }],
    [0.65, { head: { z: -0.1, y: 0.05 } }],
  ],
}

const headShake: Gesture = {
  duration: 1.25,
  keys: [
    [0.12, { head: { y: 0.22, x: 0.05 } }],
    [0.32, { head: { y: -0.25 } }],
    [0.52, { head: { y: 0.17 } }],
    [0.7, { head: { y: -0.09, x: 0.04 } }],
  ],
}

/** Head tipped, glancing aside, one hand turned up as if asking. */
const tiltCurious: Gesture = {
  duration: 2.4,
  face: 'confused',
  keys: [
    [0.2, { head: { z: -0.2, y: 0.16 }, spine: { z: 0.04 }, upperArmR: { z: 0.12, x: -0.2 }, upperArmL: { z: -0.07 } }],
    [0.34, { foreArmR: { x: -0.5, z: 0.2 }, handR: { y: 0.7, x: -0.2 } }],
    [0.76, { head: { z: -0.22, y: 0.1 }, upperArmR: { z: 0.15, x: -0.25 }, foreArmR: { x: -0.55, z: 0.24 }, handR: { y: 0.75, x: -0.2 } }],
  ],
  gaze: (p) => ({ x: 0.007 * envelope(p, [0.1, 0.3], [0.78, 0.95]), y: 0.003 * envelope(p, [0.1, 0.3], [0.78, 0.95]) }),
}

const shrugPeak: PosePatch = {
  spine: { x: -0.05 },
  head: { z: -0.12, x: -0.04 },
  upperArmR: { z: 0.5, x: -0.35 },
  upperArmL: { z: -0.44, x: -0.3 },
  foreArmR: { x: -0.55, z: 0.35 },
  foreArmL: { x: -0.5, z: -0.3 },
  handR: { y: 0.65 },
  handL: { y: -0.6 },
}

/** Shoulders up, hands open: "who knows". */
const shrug: Gesture = {
  duration: 1.6,
  keys: [
    [0.1, { upperArmR: { z: -0.05 }, upperArmL: { z: 0.05 } }],
    [0.34, shrugPeak],
    [0.64, { ...shrugPeak, head: { z: -0.1, x: -0.03 } }],
  ],
}

/** Shrug and shake the head: the apology when something went wrong. */
const apologize: Gesture = {
  duration: 1.8,
  face: 'error',
  keys: [
    [0.1, { upperArmR: { z: -0.05 }, upperArmL: { z: 0.05 } }],
    [0.3, { ...shrugPeak, head: { x: 0.06, y: 0.2 } }],
    [0.46, { head: { x: 0.06, y: -0.2 } }],
    [0.62, { ...shrugPeak, head: { x: 0.05, y: 0.1 } }],
  ],
}

/** The flipper reaches up to the side of the head and rubs it. */
const scratchHead: Gesture = {
  duration: 2.6,
  face: 'confused',
  keys: [
    [0.3, { upperArmR: { z: 2.45, x: -0.25 }, foreArmR: { z: 0.55, x: -0.2 }, handR: { z: 0.45 }, head: { z: -0.14, x: 0.05 }, spine: { z: 0.05 } }],
    [0.76, { upperArmR: { z: 2.4, x: -0.25 }, foreArmR: { z: 0.55, x: -0.2 }, handR: { z: 0.45 }, head: { z: -0.12, x: 0.04 } }],
  ],
  wiggle: (t, p) => {
    const rub = envelope(p, [0.28, 0.36], [0.7, 0.78])
    return { handR: { z: 0.3 * Math.sin(t * 11) * rub }, foreArmR: { z: 0.12 * Math.sin(t * 11 - 1) * rub } }
  },
  gaze: (p) => ({ x: -0.005 * envelope(p, [0.2, 0.35], [0.75, 0.9]), y: 0.004 * envelope(p, [0.2, 0.35], [0.75, 0.9]) }),
}

// ── Explaining and speaking ─────────────────────────────────────────────────

/** "Wait, let me correct that": one hand up, palm out. */
const raiseHand: Gesture = {
  duration: 1.8,
  keys: [
    [0.12, { upperArmR: { x: 0.12 } }],
    [0.32, { upperArmR: { x: -1.2, z: 0.3 }, foreArmR: { x: -0.7 }, handR: { x: -0.45, y: 0.25 }, head: { z: 0.05, x: 0.03 }, spine: { y: -0.05 } }],
    [0.72, { upperArmR: { x: -1.1, z: 0.28 }, foreArmR: { x: -0.65 }, handR: { x: -0.4, y: 0.25 } }],
  ],
}

/** A beat: the hand lifts, then lands on the word being stressed. */
const beatR: Gesture = {
  duration: 1.15,
  keys: [
    [0.28, { upperArmR: { x: -0.6, z: 0.28 }, foreArmR: { x: -0.5 }, handR: { x: -0.35, y: 0.3 }, spine: { y: -0.06 }, head: { y: -0.05 } }],
    [0.46, { upperArmR: { x: -0.42, z: 0.24 }, foreArmR: { x: -0.3 }, handR: { x: 0.18, y: 0.3 }, head: { x: 0.07 } }],
    [0.7, { upperArmR: { x: -0.38, z: 0.2 }, foreArmR: { x: -0.25 }, handR: { x: 0.05, y: 0.2 } }],
  ],
}

/** Every offset in `patch` times `k`. */
const scale = (patch: PosePatch, k: number): PosePatch =>
  Object.fromEntries(
    Object.entries(patch).map(([bone, angles]) => [bone, Object.fromEntries(Object.entries(angles ?? {}).map(([axis, v]) => [axis, v * k]))]),
  ) as PosePatch

/** The left-hand beat: not the right's exact mirror image, but a little smaller and slower. */
const beatL: Gesture = {
  duration: 1.25,
  keys: beatR.keys.map(([at, patch]) => [Math.min(0.9, at * 1.06), scale(mirror(patch), 0.85)]),
}

/** Both hands press down together: summing up a point. */
const beatBoth: Gesture = {
  duration: 1.1,
  keys: [
    [0.28, { upperArmR: { x: -0.55, z: 0.18 }, upperArmL: { x: -0.5, z: -0.16 }, foreArmR: { x: -0.45 }, foreArmL: { x: -0.4 }, handR: { x: -0.3 }, handL: { x: -0.25 }, spine: { x: -0.02 } }],
    [0.48, { upperArmR: { x: -0.38, z: 0.16 }, upperArmL: { x: -0.33, z: -0.14 }, foreArmR: { x: -0.28 }, foreArmL: { x: -0.25 }, handR: { x: 0.22 }, handL: { x: 0.2 }, head: { x: 0.08 }, spine: { x: 0.03 } }],
    [0.72, { upperArmR: { x: -0.3, z: 0.12 }, upperArmL: { x: -0.26, z: -0.1 }, foreArmR: { x: -0.2 }, foreArmL: { x: -0.18 } }],
  ],
}

/** One hand out, palm turned up: "you see?" */
const palmUp: Gesture = {
  duration: 1.5,
  keys: [
    [0.3, { upperArmR: { x: -0.7, z: 0.55 }, foreArmR: { x: -0.35, z: 0.2 }, handR: { y: 0.9, x: -0.1 }, head: { z: 0.08, y: -0.08 }, spine: { y: -0.05 } }],
    [0.68, { upperArmR: { x: -0.62, z: 0.5 }, foreArmR: { x: -0.32, z: 0.18 }, handR: { y: 0.85 }, head: { z: 0.05 } }],
  ],
}

/** Both hands open outwards, the left a beat behind the right: starting an explanation. */
const openPalms: Gesture = {
  duration: 1.9,
  keys: [
    [0.28, { upperArmR: { x: -0.75, z: 0.55 }, foreArmR: { x: -0.35, z: 0.25 }, handR: { y: 0.55, x: -0.2 }, spine: { x: 0.05 }, head: { x: -0.04 } }],
    [0.38, { upperArmL: { x: -0.68, z: -0.48 }, foreArmL: { x: -0.32, z: -0.22 }, handL: { y: -0.5, x: -0.15 } }],
    [0.7, { upperArmR: { x: -0.66, z: 0.5 }, foreArmR: { x: -0.32, z: 0.22 }, handR: { y: 0.5 }, spine: { x: 0.03 } }],
    [0.76, { upperArmL: { x: -0.6, z: -0.44 }, foreArmL: { x: -0.3, z: -0.2 }, handL: { y: -0.45 } }],
  ],
}

// ── Thinking (held while it thinks) ─────────────────────────────────────────

/**
 * Hand to its chin, the other arm across its belly, looking up and away. The arms
 * are too short to reach the chin, so the hand points in and up at it from in front.
 */
const thinkChin: Gesture = {
  duration: 1.8,
  holdAt: 0.5,
  face: 'thinking',
  keys: [
    [
      0.5,
      {
        upperArmR: { x: -2.15, z: -0.6 },
        foreArmR: { x: -0.55 },
        handR: { x: -0.4 },
        upperArmL: { x: -1, z: 0.75 },
        foreArmL: { x: -0.2 },
        head: { x: -0.12, z: 0.1, y: -0.1 },
        spine: { x: -0.03, y: 0.05 },
      },
    ],
  ],
  // A slow tap of the "fingers" on the chin while it holds.
  wiggle: (t, p) => ({ handR: { x: 0.08 * Math.sin(t * 2.3) * smooth(0.45, 0.5, p) } }),
  gaze: (p) => ({ x: -0.006 * smooth(0.15, 0.45, p), y: 0.004 * smooth(0.15, 0.45, p) }),
}

/**
 * Hands behind its back, chest out, looking up and aside: a longer think. (Folded
 * arms would read better, but these arms are too short to cross in front.)
 */
const handsBehind: Gesture = {
  duration: 2,
  holdAt: 0.5,
  face: 'thinking',
  keys: [
    [0.3, { upperArmR: { x: 0.35, z: 0.1 }, upperArmL: { x: 0.3, z: -0.08 } }],
    [
      0.5,
      {
        upperArmR: { x: 0.75, z: -0.25 },
        foreArmR: { x: 0.4, z: -0.3 },
        upperArmL: { x: 0.7, z: 0.25 },
        foreArmL: { x: 0.35, z: 0.3 },
        head: { x: -0.1, z: 0.08, y: 0.15 },
        spine: { x: -0.05 },
      },
    ],
  ],
  gaze: (p) => ({ x: 0.005 * smooth(0.2, 0.5, p), y: 0.003 * smooth(0.2, 0.5, p) }),
}

// ── Greeting and reactions ──────────────────────────────────────────────────

/** Arm up, the forearm and wrist doing the waving, each a little behind the other. */
const wave: Gesture = {
  duration: 2.3,
  keys: [
    [0.1, { upperArmR: { z: -0.08 } }],
    [0.28, { upperArmR: { z: 2.0, x: -0.35 }, foreArmR: { z: 0.3, x: -0.2 }, head: { z: 0.08, y: -0.06 }, spine: { z: -0.04 } }],
    [0.78, { upperArmR: { z: 1.95, x: -0.3 }, foreArmR: { z: 0.3, x: -0.2 }, head: { z: 0.06 } }],
  ],
  wiggle: (t, p) => {
    const waving = envelope(p, [0.25, 0.35], [0.7, 0.8])
    return { handR: { z: 0.5 * Math.sin(t * 9) * waving }, foreArmR: { z: 0.18 * Math.sin(t * 9 - 0.9) * waving } }
  },
}

/** A small, contained fist pump. */
const cheer: Gesture = {
  duration: 1.5,
  keys: [
    [0.12, { upperArmR: { x: 0.15 }, spine: { x: 0.03 } }],
    [0.32, { upperArmR: { x: -0.95, z: 0.55 }, foreArmR: { x: -1 }, handR: { x: -0.35 }, spine: { x: -0.05 }, head: { x: -0.1, z: 0.06 } }],
    [0.45, { upperArmR: { x: -0.75, z: 0.5 }, foreArmR: { x: -1.1 } }],
    [0.62, { upperArmR: { x: -0.9, z: 0.55 }, foreArmR: { x: -1 } }],
  ],
}

/** Both hands to its cheeks, head swaying: touched by a thank-you. */
const cheeks: Gesture = {
  duration: 2.4,
  face: 'love',
  keys: [
    [
      0.3,
      {
        upperArmR: { z: 2.55, x: 0.6 },
        foreArmR: { z: -0.8 },
        handR: { z: -0.3 },
        upperArmL: { z: -2.5, x: 0.55 },
        foreArmL: { z: 0.76 },
        handL: { z: 0.3 },
        head: { z: -0.1 },
      },
    ],
    [
      0.76,
      {
        upperArmR: { z: 2.5, x: 0.58 },
        foreArmR: { z: -0.76 },
        handR: { z: -0.28 },
        upperArmL: { z: -2.45, x: 0.53 },
        foreArmL: { z: 0.72 },
        handL: { z: 0.28 },
        head: { z: 0.08 },
      },
    ],
  ],
}

/** A start: arms jerk up and out, head back, then it collects itself. */
const startle: Gesture = {
  duration: 1.1,
  keys: [
    [0.12, { upperArmR: { z: 1.2, x: -0.5 }, upperArmL: { z: -1.15, x: -0.45 }, foreArmR: { z: 0.4 }, foreArmL: { z: -0.4 }, spine: { x: -0.1 }, head: { x: -0.2 } }],
    [0.4, { upperArmR: { z: 0.6 }, upperArmL: { z: -0.55 }, spine: { x: -0.04 }, head: { x: -0.06 } }],
  ],
}

// ── While waiting ───────────────────────────────────────────────────────────

/** A look off to one side, then back past the middle. */
const lookAround: Gesture = {
  duration: 3.2,
  keys: [
    [0.25, { head: { y: 0.42, x: -0.03 }, spine: { y: 0.08 } }],
    [0.5, { head: { y: 0.38 }, spine: { y: 0.07 } }],
    [0.72, { head: { y: -0.12 } }],
  ],
  gaze: (p) => {
    // The eyes lead the head: they reach the side first.
    const side = smooth(0.05, 0.18, p) * (1 - smooth(0.5, 0.66, p)) - 0.3 * smooth(0.6, 0.7, p) * (1 - smooth(0.78, 0.92, p))
    return { x: 0.008 * side, y: 0 }
  },
}

/** Weight onto one foot and back: hips tip, the spine and head counter it. */
const weightShift: Gesture = {
  duration: 3.6,
  keys: [
    [0.35, { hips: { z: 0.045 }, spine: { z: -0.06 }, head: { z: 0.03 }, legL: { z: -0.045 }, legR: { z: -0.045 }, upperArmR: { z: -0.04 }, upperArmL: { z: -0.03 } }],
    [0.7, { hips: { z: 0.04 }, spine: { z: -0.05 }, legL: { z: -0.04 }, legR: { z: -0.04 } }],
  ],
}

export const GESTURES = {
  nod,
  nodSmall,
  tiltListen,
  headShake,
  tiltCurious,
  shrug,
  apologize,
  scratchHead,
  raiseHand,
  beatR,
  beatL,
  beatBoth,
  palmUp,
  openPalms,
  thinkChin,
  handsBehind,
  wave,
  cheer,
  cheeks,
  startle,
  lookAround,
  weightShift,
} satisfies Record<string, Gesture>

export type GestureName = keyof typeof GESTURES

/** Per channel, its keys with the implicit zero at the start and end, ready to sample. */
type Track = [number, number][]
const tracks = new Map<Gesture, Map<string, Track>>()

function tracksOf(gesture: Gesture): Map<string, Track> {
  let found = tracks.get(gesture)
  if (found) return found
  found = new Map()
  for (const [at, patch] of gesture.keys) {
    for (const bone in patch) {
      const angles = patch[bone as keyof PosePatch] ?? {}
      for (const axis in angles) {
        const channel = `${bone}.${axis}`
        const track = found.get(channel) ?? [[0, 0]]
        track.push([at, angles[axis as 'x'] as number])
        found.set(channel, track)
      }
    }
  }
  for (const track of found.values()) track.push([1, 0])
  tracks.set(gesture, found)
  return found
}

/** The gesture's offsets at `progress` (0–1), eased between keys, plus its wiggle at `t` seconds. */
export function sampleGesture(gesture: Gesture, progress: number, t: number): PosePatch {
  const out: PosePatch = {}
  for (const [channel, track] of tracksOf(gesture)) {
    let i = 1
    while (i < track.length - 1 && track[i][0] < progress) i++
    const [a, va] = track[i - 1]
    const [b, vb] = track[i]
    const value = va + (vb - va) * smooth(a, b, progress)
    const [bone, axis] = channel.split('.') as [keyof PosePatch, 'x' | 'y' | 'z']
    ;(out[bone] ??= {})[axis] = value
  }
  if (gesture.wiggle) {
    const extra = gesture.wiggle(t, progress)
    for (const bone in extra) {
      const angles = extra[bone as keyof PosePatch] ?? {}
      for (const axis in angles) {
        const target = (out[bone as keyof PosePatch] ??= {})
        target[axis as 'x'] = (target[axis as 'x'] ?? 0) + (angles[axis as 'x'] as number)
      }
    }
  }
  return out
}
