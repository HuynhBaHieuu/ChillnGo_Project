/**
 * The robot's gestures: short movements laid on top of its posture.
 *
 * A gesture is a set of keyframes, offsets from the relaxed posture, eased
 * between. Each channel (bone × axis) has its own keys, so parts of one gesture
 * start and land at different moments (the shoulder leads, the head follows),
 * and every channel starts and ends at zero, so a gesture always hands back to
 * whatever posture is underneath. While a gesture moves an arm, that arm's
 * posture gives way to the relaxed one, so a gesture looks the same whatever
 * the mood. The springs in springs.ts add weight and follow-through.
 *
 * A gesture can also shape the hands (motion/hands.ts) and put a wrist on a
 * point with IK (motion/ik.ts): under the chin, on a cheek, across the belly.
 * Both fade in and out with the gesture: over its first key and after its last.
 *
 * Arm angles, as seen with the robot facing you (pose.ts has the axes):
 * upperArm z out (+ right arm), x − forward and up; foreArm x − bends the
 * elbow; hand y + turns the right palm up, − turns it out/down.
 */

import type { Side } from '../robotArms'
import type { RobotMood } from '../robotMood'

import type { HandShapeName } from './hands'
import type { Reach } from './ik'
import { mirror } from './pose'
import type { PosePatch } from './pose'

type Goal = Omit<Reach, 'weight'>

export interface Gesture {
  /** Seconds, start to finish. */
  duration: number
  /** [progress 0–1, offsets]. Channels not named at a key carry on between their own keys. */
  keys: [number, PosePatch][]
  /** Held gestures (thinking poses, counting) stop at this progress until released, then finish. */
  holdAt?: number
  /** A movement on top of the keys, given seconds since start and progress (a wrist's wave). */
  wiggle?: (t: number, progress: number) => PosePatch
  /** The face to show while it plays. */
  face?: RobotMood
  /** Where the eyes look while it plays (screen units), given progress. */
  gaze?: (progress: number) => { x: number; y: number }
  /** The hand shapes it makes. */
  hands?: Partial<Record<Side, HandShapeName>>
  /** Wrists it places with IK. */
  reach?: Partial<Record<Side, Goal>>
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** 0 at the edges, 1 between `rise` and `fall`: for wiggles that should only run mid-gesture. */
const envelope = (p: number, rise: [number, number], fall: [number, number]) => smooth(rise[0], rise[1], p) * (1 - smooth(fall[0], fall[1], p))

/** How much of a gesture's hand shapes, IK and arm posture apply: in over its first key, out after its last. */
export function presence(gesture: Gesture, progress: number) {
  const first = gesture.keys[0][0]
  const last = gesture.keys.at(-1)![0]
  return smooth(0, first, progress) * (1 - smooth(last, 1, progress))
}

const flipX = ([x, y, z]: readonly [number, number, number]): [number, number, number] => [-x, y, z]
const mirrorGoal = (goal: Goal): Goal => ({
  ...goal,
  at: flipX(goal.at),
  lay: goal.lay && { fingers: flipX(goal.lay.fingers), palm: flipX(goal.lay.palm) },
})

/** The same gesture done with the other arm. */
export function mirrorGesture(g: Gesture): Gesture {
  const swap = <T>(r?: Partial<Record<Side, T>>) => r && ({ L: r.R, R: r.L } as Partial<Record<Side, T>>)
  const wiggle = g.wiggle
  return {
    ...g,
    keys: g.keys.map(([at, patch]) => [at, mirror(patch)]),
    wiggle: wiggle && ((t, p) => mirror(wiggle(t, p))),
    gaze: g.gaze && ((p) => ({ ...g.gaze!(p), x: -g.gaze!(p).x })),
    hands: swap(g.hands),
    reach: g.reach && { L: g.reach.R && mirrorGoal(g.reach.R), R: g.reach.L && mirrorGoal(g.reach.L) },
  }
}

/** Every offset in `patch` times `k`. */
const scale = (patch: PosePatch, k: number): PosePatch =>
  Object.fromEntries(
    Object.entries(patch).map(([bone, angles]) => [bone, Object.fromEntries(Object.entries(angles ?? {}).map(([axis, v]) => [axis, v * k]))]),
  ) as PosePatch

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

/** One open hand turned up in front, forearm forward: "you see?". The shared arm pose of several gestures. */
const palmOut = (k = 1): PosePatch => ({
  upperArmR: { x: -0.4 * k, z: 0.3 * k },
  foreArmR: { x: -1.05 * k },
  handR: { y: 1.35 * k, z: 0.1 * k },
})

/** Head tipped, glancing aside, one hand turned up as if asking. */
const tiltCurious: Gesture = {
  duration: 2.4,
  face: 'confused',
  hands: { R: 'open' },
  keys: [
    [0.2, { head: { z: -0.2, y: 0.16 }, spine: { z: 0.04 }, upperArmL: { z: -0.05 } }],
    [0.34, palmOut(0.9)],
    [0.76, { head: { z: -0.22, y: 0.1 }, ...palmOut(1) }],
  ],
  gaze: (p) => ({ x: 0.007 * envelope(p, [0.1, 0.3], [0.78, 0.95]), y: 0.003 * envelope(p, [0.1, 0.3], [0.78, 0.95]) }),
}

/** Elbows out, forearms forward, both palms up. */
const shrugPeak: PosePatch = {
  spine: { x: -0.05 },
  head: { z: -0.12, x: -0.04 },
  upperArmR: { z: 0.42, x: -0.2 },
  upperArmL: { z: -0.38, x: -0.18 },
  foreArmR: { x: -1.25 },
  foreArmL: { x: -1.15 },
  handR: { y: 1.4, z: 0.2 },
  handL: { y: -1.35, z: -0.18 },
}

/** Shoulders up, hands open: "who knows". */
const shrug: Gesture = {
  duration: 1.6,
  hands: { L: 'open', R: 'open' },
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
  hands: { L: 'open', R: 'open' },
  keys: [
    [0.1, { upperArmR: { z: -0.05 }, upperArmL: { z: 0.05 } }],
    [0.3, { ...shrugPeak, head: { x: 0.06, y: 0.2 } }],
    [0.46, { head: { x: 0.06, y: -0.2 } }],
    [0.62, { ...shrugPeak, head: { x: 0.05, y: 0.1 } }],
  ],
}

/** The hand goes up to the side of the head and the fingers scratch. */
const scratchHead: Gesture = {
  duration: 2.6,
  face: 'confused',
  hands: { R: 'claw' },
  reach: { R: { ref: 'head', at: [0.086, 0.038, 0.024] } },
  keys: [
    [0.3, { upperArmR: { z: 2.2, x: -0.35 }, foreArmR: { x: -1.3 }, handR: { y: -0.9, z: -0.4 }, head: { z: -0.14, x: 0.05 }, spine: { z: 0.05 } }],
    [0.76, { upperArmR: { z: 2.15, x: -0.35 }, foreArmR: { x: -1.3 }, handR: { y: -0.9, z: -0.4 }, head: { z: -0.12, x: 0.04 } }],
  ],
  wiggle: (t, p) => {
    const rub = envelope(p, [0.28, 0.36], [0.7, 0.78])
    return { handR: { z: 0.28 * Math.sin(t * 12) * rub }, foreArmR: { x: 0.06 * Math.sin(t * 12 - 1) * rub } }
  },
  gaze: (p) => ({ x: -0.005 * envelope(p, [0.2, 0.35], [0.75, 0.9]), y: 0.004 * envelope(p, [0.2, 0.35], [0.75, 0.9]) }),
}

// ── Explaining and speaking ─────────────────────────────────────────────────

/** "Wait, let me correct that": one hand up, palm out. */
const raiseHand: Gesture = {
  duration: 1.8,
  hands: { R: 'open' },
  keys: [
    [0.12, { upperArmR: { x: 0.12 } }],
    [0.32, { upperArmR: { x: -0.65, z: 0.32 }, foreArmR: { x: -1.75 }, handR: { y: -1.35, z: 0.25 }, head: { z: 0.05, x: 0.03 }, spine: { y: -0.05 } }],
    [0.72, { upperArmR: { x: -0.6, z: 0.3 }, foreArmR: { x: -1.7 }, handR: { y: -1.3, z: 0.22 } }],
  ],
}

/** A beat: the hand lifts, then drops onto the stressed word, the wrist flicking down a moment after. */
const beatR: Gesture = {
  duration: 1.1,
  hands: { R: 'relaxed' },
  keys: [
    [0.3, { upperArmR: { x: -0.4, z: 0.22 }, foreArmR: { x: -1.25 }, handR: { x: -0.3, y: 0.5 }, spine: { y: -0.06 }, head: { y: -0.05 } }],
    [0.46, { upperArmR: { x: -0.3, z: 0.2 }, foreArmR: { x: -0.85 }, handR: { x: 0.25, y: 0.5 }, head: { x: 0.07 } }],
    [0.7, { upperArmR: { x: -0.25, z: 0.16 }, foreArmR: { x: -0.75 }, handR: { x: 0.08, y: 0.4 } }],
  ],
}

/** The left-hand beat: not the right's exact mirror image, but a little smaller and slower. */
const beatL: Gesture = (() => {
  const m = mirrorGesture(beatR)
  return { ...m, duration: 1.2, keys: m.keys.map(([at, patch]) => [Math.min(0.9, at * 1.06), scale(patch, 0.85)]) }
})()

/** Index and thumb pinched together, the hand nudging forward on the word: making a fine point. */
const pinchBeat: Gesture = {
  duration: 1.25,
  hands: { R: 'pinch' },
  keys: [
    [0.3, { upperArmR: { x: -0.5, z: 0.2 }, foreArmR: { x: -1.45 }, handR: { y: 0.3, x: -0.2 }, head: { z: 0.04 } }],
    [0.5, { upperArmR: { x: -0.55, z: 0.18 }, foreArmR: { x: -1.2 }, handR: { y: 0.3, x: 0.15 }, head: { x: 0.06 } }],
    [0.72, { upperArmR: { x: -0.5, z: 0.18 }, foreArmR: { x: -1.25 }, handR: { y: 0.3 } }],
  ],
}

/** Both hands press down together: summing up a point. */
const beatBoth: Gesture = {
  duration: 1.1,
  hands: { L: 'relaxed', R: 'relaxed' },
  keys: [
    [0.28, { upperArmR: { x: -0.4, z: 0.16 }, upperArmL: { x: -0.36, z: -0.14 }, foreArmR: { x: -1.2 }, foreArmL: { x: -1.1 }, handR: { y: -0.6, x: -0.25 }, handL: { y: 0.6, x: -0.2 }, spine: { x: -0.02 } }],
    [0.48, { upperArmR: { x: -0.3, z: 0.15 }, upperArmL: { x: -0.27, z: -0.13 }, foreArmR: { x: -0.85 }, foreArmL: { x: -0.8 }, handR: { y: -0.6, x: 0.25 }, handL: { y: 0.6, x: 0.22 }, head: { x: 0.08 }, spine: { x: 0.03 } }],
    [0.72, { upperArmR: { x: -0.25, z: 0.12 }, upperArmL: { x: -0.22, z: -0.1 }, foreArmR: { x: -0.7 }, foreArmL: { x: -0.65 }, handR: { y: -0.5 }, handL: { y: 0.5 } }],
  ],
}

/** One hand out, palm turned up: "you see?" */
const palmUp: Gesture = {
  duration: 1.5,
  hands: { R: 'open' },
  keys: [
    [0.3, { ...palmOut(1), head: { z: 0.08, y: -0.08 }, spine: { y: -0.05 } }],
    [0.68, { ...palmOut(0.9), head: { z: 0.05 } }],
  ],
}

/** Both hands open outwards, the left a beat behind the right: starting an explanation. */
const openPalms: Gesture = {
  duration: 1.9,
  hands: { L: 'open', R: 'open' },
  keys: [
    [0.28, { ...palmOut(1), spine: { x: 0.05 }, head: { x: -0.04 } }],
    [0.38, mirror(palmOut(0.92))],
    [0.7, { ...palmOut(0.9), spine: { x: 0.03 } }],
    [0.76, mirror(palmOut(0.85))],
  ],
}

/** Thumbs up, the arm pushing it forward a little, with a nod: "really worth it". */
const thumbsUp: Gesture = {
  duration: 1.9,
  face: 'happy',
  hands: { R: 'thumbsUp' },
  // Forearm pointing at the viewer, so the fist is in front of the chest and the thumb stands up.
  keys: [
    [0.14, { upperArmR: { x: 0.1 }, foreArmR: { x: -0.4 } }],
    [0.32, { upperArmR: { x: -0.6, z: 0.06 }, foreArmR: { x: -1 }, handR: { y: 0.15, x: -0.15 }, head: { x: 0.1, z: 0.06 }, spine: { x: 0.03 } }],
    [0.44, { upperArmR: { x: -0.68, z: 0.06 }, foreArmR: { x: -0.95 }, head: { x: 0.02 } }],
    [0.74, { upperArmR: { x: -0.64, z: 0.06 }, foreArmR: { x: -1 }, handR: { y: 0.15, x: -0.15 }, head: { z: 0.04 } }],
  ],
}

/** A hand held up in front, palm out, counting on its fingers; the director sets how many. */
const count: Gesture = {
  duration: 1.4,
  holdAt: 0.5,
  hands: { R: 'one' },
  keys: [
    [0.5, { upperArmR: { x: -0.55, z: 0.3 }, foreArmR: { x: -1.85 }, handR: { y: -1.3, z: 0.15 }, head: { z: 0.05, y: -0.04 } }],
  ],
}

/** A flat hand laid on its chest: sincere. */
const handOnChest: Gesture = {
  duration: 2.2,
  face: 'happy',
  hands: { R: 'flat' },
  reach: { R: { ref: 'spine', at: [0.024, 0.021, 0.061] } },
  keys: [
    [0.3, { upperArmR: { x: -0.6, z: -0.25 }, foreArmR: { x: -1.6 }, handR: { z: -0.6, y: -0.4 }, head: { x: 0.08, z: 0.06 }, spine: { x: 0.03 } }],
    [0.75, { upperArmR: { x: -0.6, z: -0.25 }, foreArmR: { x: -1.6 }, handR: { z: -0.6, y: -0.4 }, head: { x: 0.04, z: 0.05 } }],
  ],
}

// ── Thinking (held while it thinks) ─────────────────────────────────────────

/** Chin resting on a half-closed hand, the other arm across its belly, looking up and away. */
const thinkChin: Gesture = {
  duration: 1.8,
  holdAt: 0.5,
  face: 'thinking',
  hands: { R: 'cup', L: 'flat' },
  reach: {
    R: { ref: 'head', at: [0.024, -0.003, 0.06] },
    L: { ref: 'spine', at: [-0.024, 0.008, 0.057] },
  },
  keys: [
    [
      0.5,
      {
        upperArmR: { x: -0.6, z: -0.15 },
        foreArmR: { x: -2.2 },
        handR: { y: -0.5, x: -0.3 },
        upperArmL: { x: -0.45, z: 0.15 },
        foreArmL: { x: -1.4 },
        handL: { z: 0.7, y: 0.4 },
        // Leaning onto the hand a little, looking off.
        head: { x: 0.05, z: -0.08, y: 0.08 },
        spine: { x: 0.03, y: 0.05 },
      },
    ],
  ],
  // A slow tap of the fingers against the chin while it holds.
  wiggle: (t, p) => ({ handR: { z: 0.06 * Math.sin(t * 2.3) * smooth(0.45, 0.5, p) } }),
  gaze: (p) => ({ x: -0.006 * smooth(0.15, 0.45, p), y: 0.004 * smooth(0.15, 0.45, p) }),
}

/** Arms folded across the belly, head tipped: a longer think. */
const foldArms: Gesture = {
  duration: 2,
  holdAt: 0.5,
  face: 'thinking',
  hands: { R: 'flat', L: 'fist' },
  reach: {
    R: { ref: 'spine', at: [0.028, 0.012, 0.06] },
    L: { ref: 'spine', at: [-0.026, 0.005, 0.052] },
  },
  keys: [
    [0.3, { upperArmR: { x: -0.4 }, upperArmL: { x: -0.35 } }],
    [
      0.5,
      {
        upperArmR: { x: -0.35, z: 0.1 },
        foreArmR: { x: -1.5 },
        handR: { z: -0.9 },
        upperArmL: { x: -0.32, z: -0.08 },
        foreArmL: { x: -1.45 },
        handL: { z: 0.8 },
        head: { x: 0.04, z: 0.07, y: 0.12 },
        spine: { x: -0.03 },
      },
    ],
  ],
  gaze: (p) => ({ x: 0.005 * smooth(0.2, 0.5, p), y: -0.002 * smooth(0.2, 0.5, p) }),
}

/** Hands behind its back, chest out, looking up and aside: the other long think. */
const handsBehind: Gesture = {
  duration: 2,
  holdAt: 0.5,
  face: 'thinking',
  hands: { L: 'relaxed', R: 'relaxed' },
  keys: [
    [0.3, { upperArmR: { x: 0.3, z: 0.1 }, upperArmL: { x: 0.26, z: -0.08 } }],
    [
      0.5,
      {
        upperArmR: { x: 0.55, z: -0.18 },
        foreArmR: { x: -0.9 },
        upperArmL: { x: 0.5, z: 0.18 },
        foreArmL: { x: -0.85 },
        head: { x: -0.1, z: 0.08, y: 0.15 },
        spine: { x: -0.05 },
      },
    ],
  ],
  gaze: (p) => ({ x: 0.005 * smooth(0.2, 0.5, p), y: 0.003 * smooth(0.2, 0.5, p) }),
}

// ── Greeting and reactions ──────────────────────────────────────────────────

/**
 * A wave: the elbow comes out to the side at shoulder height, the forearm
 * stands up from it with the palm to the viewer, then rocks from the elbow, the
 * hand flopping a beat behind.
 *
 * With the upper arm out sideways, its x angle is a twist about its own length;
 * near −π/2 it turns the elbow so that it bends upwards in the plane facing
 * the viewer rather than towards them (which reads as a stiff, straight arm).
 */
const wave: Gesture = {
  duration: 2.5,
  hands: { R: 'open' },
  keys: [
    [0.08, { upperArmR: { z: -0.06 }, spine: { z: 0.02 } }],
    // The elbow leads; the forearm and hand arrive a moment later.
    [0.24, { upperArmR: { x: -1.42, z: 1.02 }, head: { z: 0.07, y: -0.05 }, spine: { z: -0.045 } }],
    [0.3, { foreArmR: { x: -0.95 }, handR: { y: 0.3, x: -0.15 } }],
    [0.78, { upperArmR: { x: -1.42, z: 0.98 }, foreArmR: { x: -0.95 }, handR: { y: 0.3 }, head: { z: 0.06 }, spine: { z: -0.04 } }],
  ],
  wiggle: (t, p) => {
    const waving = envelope(p, [0.28, 0.38], [0.7, 0.8])
    return {
      foreArmR: { x: 0.26 * Math.sin(t * 9) * waving },
      handR: { x: 0.3 * Math.sin(t * 9 - 1) * waving },
      upperArmR: { z: 0.04 * Math.sin(t * 9 + 0.5) * waving },
    }
  },
}

/** A small, contained fist pump. */
const cheer: Gesture = {
  duration: 1.5,
  hands: { R: 'fist' },
  keys: [
    [0.12, { upperArmR: { x: 0.15 }, spine: { x: 0.03 } }],
    [0.32, { upperArmR: { x: -0.85, z: 0.45 }, foreArmR: { x: -2 }, handR: { y: 0.3 }, spine: { x: -0.05 }, head: { x: -0.1, z: 0.06 } }],
    [0.45, { upperArmR: { x: -0.6, z: 0.4 }, foreArmR: { x: -2.15 } }],
    [0.62, { upperArmR: { x: -0.8, z: 0.45 }, foreArmR: { x: -2 } }],
  ],
}

/** Hands pressed to its cheeks, elbows in, the arm pose both keys of `cheeks` hold. */
const holdingFace: PosePatch = {
  upperArmR: { x: -0.9, z: -0.15 },
  foreArmR: { x: -1.5 },
  upperArmL: { x: -0.9, z: 0.15 },
  foreArmL: { x: -1.5 },
}
/**
 * A palm on a cheek. The face is a box well in front of the shoulders, so its
 * cheeks are its lower front corners: the hand wraps one, fingers up the
 * screen's edge, palm turned in and back against it.
 */
const onCheek: Goal = { ref: 'head', at: [0.068, 0.02, 0.056], lay: { fingers: [-0.12, 1, -0.05], palm: [-0.75, 0, -0.65] } }

/**
 * Bashful at a thank-you: both hands pressed to its cheeks (the lower corners
 * of the screen, in front, where they can be seen), head ducked, squirming from
 * side to side. The hands are placed on the head, so they stay on its cheeks as
 * it sways.
 */
const cheeks: Gesture = {
  duration: 3,
  face: 'love',
  hands: { L: 'flat', R: 'flat' },
  reach: { R: onCheek, L: mirrorGoal(onCheek) },
  keys: [
    [0.24, { ...holdingFace, head: { x: 0.1 }, spine: { x: 0.05 } }],
    [0.8, { ...holdingFace, head: { x: 0.09 }, spine: { x: 0.04 } }],
  ],
  // The squirm: shoulders one way, head the other, a beat behind.
  wiggle: (t, p) => {
    const squirm = envelope(p, [0.2, 0.34], [0.72, 0.84])
    return {
      spine: { y: 0.09 * Math.sin(t * 5.2) * squirm, z: 0.035 * Math.sin(t * 5.2) * squirm },
      head: { z: -0.1 * Math.sin(t * 5.2 - 0.7) * squirm, y: 0.05 * Math.sin(t * 5.2 - 0.7) * squirm },
      hips: { z: -0.02 * Math.sin(t * 5.2) * squirm },
    }
  },
}

/** A start: arms jerk up and out, head back, then it collects itself. */
const startle: Gesture = {
  duration: 1.1,
  hands: { L: 'open', R: 'open' },
  keys: [
    [0.12, { upperArmR: { z: 0.9, x: -0.4 }, upperArmL: { z: -0.85, x: -0.35 }, foreArmR: { x: -1.2 }, foreArmL: { x: -1.1 }, spine: { x: -0.1 }, head: { x: -0.2 } }],
    [0.4, { upperArmR: { z: 0.45 }, upperArmL: { z: -0.4 }, foreArmR: { x: -0.6 }, foreArmL: { x: -0.5 }, spine: { x: -0.04 }, head: { x: -0.06 } }],
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

/** Weight onto one foot and back: hips tip, the spine and head counter it, the arms swing a touch. */
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
  pinchBeat,
  beatBoth,
  palmUp,
  openPalms,
  thumbsUp,
  count,
  handOnChest,
  thinkChin,
  foldArms,
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
