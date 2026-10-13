/**
 * The hands. Each has a shape: how far each finger curls, how far they fan
 * out, and where the thumb is. The posture gives a resting shape, gestures
 * blend theirs over it, and springs carry the fingers there, the index a beat
 * ahead of the others, so a hand closes finger by finger rather than in one
 * piece.
 *
 * Seen from the hand (robotArms.ts): the fingers point along −y, the palm faces
 * the body (−x for the right hand) and the thumb sits at the front (+z).
 * Curling turns a finger about z towards the palm; fanning turns it about x.
 */

import type { HandBones, Side } from '../robotArms'

export interface HandShape {
  /** 0 straight … 1 curled into the palm: index, middle, ring. */
  curl: [number, number, number]
  /** 0 together … 1 fanned out. */
  spread: number
  /** The thumb: 0 alongside the palm … 1 standing out straight (thumbs-up). */
  thumbUp: number
  /** 0 off to the side … 1 folded over the curled fingers (a fist). */
  thumbTuck: number
}

const shape = (curl: [number, number, number], spread: number, thumbUp: number, thumbTuck: number): HandShape => ({
  curl,
  spread,
  thumbUp,
  thumbTuck,
})

export const HANDS = {
  /** Loosely curled, the ring finger more than the index: a hand at rest is never flat. */
  relaxed: shape([0.3, 0.38, 0.47], 0.12, 0, 0.2),
  open: shape([0.05, 0.04, 0.08], 0.6, 0.25, 0),
  /** Flat, fingers together: laid on a cheek or the chest. */
  flat: shape([0.06, 0.05, 0.07], 0.08, 0.05, 0.05),
  /** Half closed under the chin. */
  cup: shape([0.62, 0.68, 0.74], 0.08, 0.05, 0.35),
  fist: shape([1, 1, 1], 0, 0, 1),
  thumbsUp: shape([1, 1, 1], 0, 1, 0),
  /** Counting on its fingers. */
  one: shape([0, 1, 1], 0.1, 0, 0.9),
  two: shape([0, 0, 1], 0.5, 0, 0.9),
  three: shape([0, 0, 0], 0.5, 0, 0.85),
  four: shape([0, 0, 0], 0.55, 0.85, 0),
  /** Index and thumb nearly touching: a speaker making a fine point. */
  pinch: shape([0.58, 0.4, 0.5], 0.1, 0.2, 0.6),
  /** Fingers hooked: scratching. */
  claw: shape([0.55, 0.6, 0.62], 0.35, 0.1, 0.25),
} satisfies Record<string, HandShape>

export type HandShapeName = keyof typeof HANDS

export const COUNT: HandShapeName[] = ['one', 'two', 'three', 'four']

export function copyShape(s: HandShape): HandShape {
  return { curl: [...s.curl], spread: s.spread, thumbUp: s.thumbUp, thumbTuck: s.thumbTuck }
}

/** `into` moved `weight` of the way to `to`, in place. */
export function mixShape(into: HandShape, to: HandShape, weight: number) {
  if (weight <= 0) return
  for (let i = 0; i < 3; i++) into.curl[i] += (to.curl[i] - into.curl[i]) * weight
  into.spread += (to.spread - into.spread) * weight
  into.thumbUp += (to.thumbUp - into.thumbUp) * weight
  into.thumbTuck += (to.thumbTuck - into.thumbTuck) * weight
}

/** Stiffness per control: the index moves first, the ring finger last; damping ratio 0.8 throughout. */
const STIFFNESS = { curl: [190, 150, 120], spread: 120, thumbUp: 170, thumbTuck: 150 }
const DAMPING = 0.8
const MAX_STEP = 1 / 120

/** The hands' shapes, each control following its target through a damped spring. */
export class HandSprings {
  readonly value: Record<Side, HandShape> = { L: copyShape(HANDS.relaxed), R: copyShape(HANDS.relaxed) }
  private readonly velocity: Record<Side, HandShape> = { L: shape([0, 0, 0], 0, 0, 0), R: shape([0, 0, 0], 0, 0, 0) }

  step(target: Record<Side, HandShape>, dt: number) {
    let remaining = Math.min(dt, 0.1)
    while (remaining > 0) {
      const h = Math.min(remaining, MAX_STEP)
      remaining -= h
      for (const side of ['L', 'R'] as const) {
        const value = this.value[side]
        const velocity = this.velocity[side]
        const goal = target[side]
        for (let i = 0; i < 3; i++) {
          const k = STIFFNESS.curl[i]
          velocity.curl[i] += (k * (goal.curl[i] - value.curl[i]) - 2 * DAMPING * Math.sqrt(k) * velocity.curl[i]) * h
          value.curl[i] += velocity.curl[i] * h
        }
        for (const key of ['spread', 'thumbUp', 'thumbTuck'] as const) {
          const k = STIFFNESS[key]
          velocity[key] += (k * (goal[key] - value[key]) - 2 * DAMPING * Math.sqrt(k) * velocity[key]) * h
          value[key] += velocity[key] * h
        }
      }
    }
  }
}

/** Puts a hand's finger bones in `s`. */
export function poseHand(bones: HandBones, s: HandShape, side: Side) {
  const m = side === 'R' ? 1 : -1
  bones.fingers.forEach(([knuckle, middle], i) => {
    const curl = Math.min(1.05, Math.max(-0.1, s.curl[i]))
    // Index fans forward, ring backward; a curled finger fans less.
    const fan = (1 - i) * s.spread * 0.22 * (1 - 0.6 * curl)
    knuckle.rotation.set(-fan, 0, -m * curl * 1.45)
    middle.rotation.set(0, 0, -m * curl * 1.65)
  })
  const up = Math.min(1, Math.max(0, s.thumbUp))
  const tuck = Math.min(1, Math.max(0, s.thumbTuck)) * (1 - up)
  const [base, tip] = bones.thumb
  // Resting: down and a little forward along the palm's front edge. Up: straight out in front.
  // Tucked: folded across towards the palm.
  base.rotation.set(-0.38 - 1.37 * up - 0.45 * tuck, 0, -m * (0.28 * (1 - up) + 0.85 * tuck))
  tip.rotation.set(0, 0, -m * (0.2 + 0.75 * tuck) * (1 - up))
}
