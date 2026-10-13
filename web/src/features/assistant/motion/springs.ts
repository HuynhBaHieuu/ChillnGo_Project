/**
 * Each joint follows its target pose through a damped spring rather than
 * easing at a fixed rate. Springs give movement its weight: they speed up and
 * slow down on their own, and an under-damped joint overshoots a little and
 * settles. Joints further out (forearm, then hand) are looser than the ones
 * that carry them, so a flipper's tip trails its shoulder and catches up:
 * the follow-through that keeps the arms from moving like rigid paddles.
 */

import { BONES } from '../robotRig'
import type { BoneName } from '../robotRig'

import { restPose } from './pose'
import type { FullPose } from './pose'

/** Stiffness (how fast it pulls towards the target) and damping ratio (1 = no overshoot, lower = springier). */
const SPRING: Record<BoneName, { stiffness: number; damping: number }> = {
  hips: { stiffness: 40, damping: 0.95 },
  spine: { stiffness: 55, damping: 0.85 },
  head: { stiffness: 75, damping: 0.72 },
  upperArmL: { stiffness: 85, damping: 0.78 },
  upperArmR: { stiffness: 90, damping: 0.78 },
  foreArmL: { stiffness: 70, damping: 0.6 },
  foreArmR: { stiffness: 72, damping: 0.6 },
  handL: { stiffness: 58, damping: 0.5 },
  handR: { stiffness: 60, damping: 0.5 },
  legL: { stiffness: 60, damping: 0.9 },
  legR: { stiffness: 60, damping: 0.9 },
}

const AXES = ['x', 'y', 'z'] as const
/** Smaller steps than a frame keep stiff springs stable on slow frames. */
const MAX_STEP = 1 / 120

export class JointSprings {
  readonly value: FullPose = restPose()
  private readonly velocity: FullPose = restPose()

  /** `calm` makes every joint critically damped: no overshoot (reduced motion). */
  step(target: FullPose, dt: number, calm = false) {
    let remaining = Math.min(dt, 0.1)
    while (remaining > 0) {
      const h = Math.min(remaining, MAX_STEP)
      remaining -= h
      for (const bone of BONES) {
        const { stiffness, damping } = SPRING[bone]
        const c = 2 * (calm ? 1 : damping) * Math.sqrt(stiffness)
        const value = this.value[bone]
        const velocity = this.velocity[bone]
        const goal = target[bone]
        for (const axis of AXES) {
          velocity[axis] += (stiffness * (goal[axis] - value[axis]) - c * velocity[axis]) * h
          value[axis] += velocity[axis] * h
        }
      }
    }
  }
}
