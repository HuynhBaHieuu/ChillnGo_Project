/**
 * What the robot does with its body when no gesture is playing: a posture for
 * each conversational state, and the small, never-repeating movements of
 * something alive (breathing, weight drifting, the head and arms settling).
 * Left and right are deliberately not mirror images.
 */

import type { RobotMood } from '../robotMood'

import { noise } from './noise'
import type { PosePatch } from './pose'

/** Arms hanging loose, slightly away from the body, the flippers' tips curled in a touch. */
const RELAXED: PosePatch = {
  upperArmR: { z: 0.1, x: 0.02 },
  upperArmL: { z: -0.07, x: -0.03 },
  foreArmR: { x: -0.12 },
  foreArmL: { x: -0.08 },
  handR: { x: -0.1 },
  handL: { x: -0.06 },
}

const POSTURES: Partial<Record<RobotMood, PosePatch>> = {
  /** Leaning in, head tipped: paying attention. */
  listening: {
    ...RELAXED,
    spine: { x: 0.08 },
    head: { x: 0.04, z: -0.06 },
    upperArmR: { z: 0.1, x: -0.08 },
    upperArmL: { z: -0.08, x: -0.1 },
  },
  /** Upright, chin a little up. */
  thinking: { ...RELAXED, spine: { x: -0.02 }, head: { x: -0.08 } },
  /** Engaged: leaning slightly forward, hands lifted and ready to gesture. */
  speaking: {
    ...RELAXED,
    spine: { x: 0.04 },
    upperArmR: { x: -0.2, z: 0.16 },
    upperArmL: { x: -0.16, z: -0.14 },
    foreArmR: { x: -0.35 },
    foreArmL: { x: -0.3 },
    handR: { x: -0.12 },
    handL: { x: -0.1 },
  },
  /** Slumped, head nodding off. */
  sleepy: {
    spine: { x: 0.12 },
    head: { x: 0.32, z: 0.05 },
    upperArmR: { z: 0.03, x: 0.05 },
    upperArmL: { z: -0.03, x: 0.06 },
  },
}

export function postureFor(mood: RobotMood): PosePatch {
  return POSTURES[mood] ?? RELAXED
}

/** Breathing, a drifting weight and a restless head, added on top of everything else. */
export function lifeMotion(t: number, mood: RobotMood): PosePatch {
  const slow = mood === 'sleepy' ? 0.5 : 1
  const lively = mood === 'speaking' ? 1.5 : mood === 'sleepy' ? 0.4 : 1
  const breath = Math.sin(t * 1.5 * slow + 0.8 * noise(t * 0.07, 1)) // breathing is rhythmic, but never exactly
  return {
    hips: { z: 0.018 * noise(t * 0.13 * slow, 2) },
    spine: { x: 0.012 * breath, z: -0.012 * noise(t * 0.13 * slow, 2), y: 0.03 * noise(t * 0.09, 3) },
    head: {
      x: 0.03 * lively * noise(t * 0.33 * slow, 4),
      y: 0.05 * lively * noise(t * 0.22 * slow, 5),
      z: 0.022 * lively * noise(t * 0.28 * slow, 6),
    },
    upperArmR: { z: 0.025 * noise(t * 0.31, 7) - 0.006 * breath, x: 0.02 * noise(t * 0.23, 8) },
    upperArmL: { z: -0.02 * noise(t * 0.27, 9) + 0.006 * breath, x: 0.018 * noise(t * 0.25, 10) },
    foreArmR: { x: 0.035 * noise(t * 0.41, 11) },
    foreArmL: { x: 0.03 * noise(t * 0.37, 12) },
    handR: { x: 0.04 * noise(t * 0.53, 13), y: 0.05 * noise(t * 0.31, 14) },
    handL: { x: 0.035 * noise(t * 0.49, 15), y: -0.045 * noise(t * 0.29, 16) },
    legL: { x: 0.01 * noise(t * 0.17, 17) },
    legR: { x: 0.01 * noise(t * 0.19, 18) },
  }
}
