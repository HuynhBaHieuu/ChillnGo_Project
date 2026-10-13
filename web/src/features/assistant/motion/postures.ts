/**
 * What the robot does with its body when no gesture is playing: a posture for
 * each conversational state, a resting hand shape, and the small,
 * never-repeating movements of something alive (breathing, weight drifting,
 * the head, arms and fingers settling). Left and right are deliberately not
 * mirror images.
 */

import type { Side } from '../robotArms'
import type { RobotMood } from '../robotMood'

import { copyShape, HANDS } from './hands'
import type { HandShape } from './hands'
import { noise } from './noise'
import type { PosePatch } from './pose'

/** Arms hanging loose, a little away from the body, elbows soft, palms towards the thighs and a touch back. */
export const RELAXED: PosePatch = {
  upperArmR: { z: 0.2, x: -0.08 },
  upperArmL: { z: -0.18, x: -0.1 },
  foreArmR: { x: -0.4 },
  foreArmL: { x: -0.33 },
  handR: { y: -0.2, z: -0.08 },
  handL: { y: 0.15, z: 0.06 },
}

const POSTURES: Partial<Record<RobotMood, PosePatch>> = {
  /** Leaning in, head tipped: paying attention. */
  listening: {
    ...RELAXED,
    spine: { x: 0.08 },
    head: { x: 0.04, z: -0.06 },
    upperArmR: { z: 0.1, x: -0.14 },
    upperArmL: { z: -0.08, x: -0.16 },
    foreArmR: { x: -0.45 },
    foreArmL: { x: -0.4 },
  },
  /** Upright, chin a little up. */
  thinking: { ...RELAXED, spine: { x: -0.02 }, head: { x: -0.08 } },
  /** Engaged: leaning slightly forward, forearms up and ready to gesture. */
  speaking: {
    ...RELAXED,
    spine: { x: 0.04 },
    upperArmR: { x: -0.18, z: 0.15 },
    upperArmL: { x: -0.15, z: -0.13 },
    foreArmR: { x: -0.95 },
    foreArmL: { x: -0.85 },
    handR: { y: 0.55, z: -0.1 },
    handL: { y: -0.45, z: 0.08 },
  },
  /** Slumped, head nodding off, arms dangling. */
  sleepy: {
    spine: { x: 0.12 },
    head: { x: 0.32, z: 0.05 },
    upperArmR: { z: 0.04, x: 0.05 },
    upperArmL: { z: -0.04, x: 0.06 },
    foreArmR: { x: -0.12 },
    foreArmL: { x: -0.1 },
  },
}

const ARM_BONES = ['upperArm', 'foreArm', 'hand'] as const

/**
 * The posture for a mood. Each arm a gesture has (`arms`, 0–1) gives way to the
 * relaxed posture the gestures are written over.
 */
export function postureFor(mood: RobotMood, arms: Record<Side, number> = { L: 0, R: 0 }): PosePatch {
  const posture = POSTURES[mood] ?? RELAXED
  if (!arms.L && !arms.R) return posture
  const out: PosePatch = { ...posture }
  for (const side of ['L', 'R'] as const) {
    const w = arms[side]
    if (!w) continue
    for (const part of ARM_BONES) {
      const bone = `${part}${side}` as const
      const from = posture[bone] ?? {}
      const to = RELAXED[bone] ?? {}
      out[bone] = {
        x: (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * w,
        y: (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * w,
        z: (from.z ?? 0) + ((to.z ?? 0) - (from.z ?? 0)) * w,
      }
    }
  }
  return out
}

/** The hands at rest: loosely curled; a little more open while talking, more closed while dozing. */
export function handsFor(mood: RobotMood, t: number): Record<Side, HandShape> {
  const out = { L: copyShape(HANDS.relaxed), R: copyShape(HANDS.relaxed) }
  const open = mood === 'speaking' ? -0.08 : mood === 'sleepy' ? 0.15 : 0
  for (const side of ['L', 'R'] as const) {
    const seed = side === 'L' ? 40 : 50
    out[side].curl = out[side].curl.map((c, i) => c + open + 0.05 * noise(t * 0.35, seed + i)) as HandShape['curl']
    out[side].thumbTuck += 0.06 * noise(t * 0.3, seed + 5)
  }
  return out
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
    // The shoulders rise a little on each breath; the arms sway on their own.
    upperArmR: { z: 0.022 * noise(t * 0.31, 7) - 0.008 * breath, x: 0.02 * noise(t * 0.23, 8) },
    upperArmL: { z: -0.018 * noise(t * 0.27, 9) + 0.008 * breath, x: 0.018 * noise(t * 0.25, 10) },
    foreArmR: { x: 0.05 * noise(t * 0.41, 11) },
    foreArmL: { x: 0.045 * noise(t * 0.37, 12) },
    handR: { z: 0.05 * noise(t * 0.53, 13), y: 0.06 * noise(t * 0.31, 14) },
    handL: { z: -0.045 * noise(t * 0.49, 15), y: -0.055 * noise(t * 0.29, 16) },
    legL: { x: 0.01 * noise(t * 0.17, 17) },
    legR: { x: 0.01 * noise(t * 0.19, 18) },
  }
}
