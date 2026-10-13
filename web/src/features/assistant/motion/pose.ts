/**
 * Poses for the robot's skeleton: an Euler angle (radians) per bone, measured
 * from the model's rest pose (standing, arms hanging).
 *
 * Axes, as seen with the robot facing you (it faces +z):
 *   head / spine  x: + bows forward, − leans back · y: turns · z: tilts
 *   arms          z: swings the arm out sideways (+ for the right arm, − for the left)
 *                 x: − swings forward and up, + back
 *                 y: twists along the arm (turns the flat flipper / "palm" up or out)
 *   fore / hand   same axes, relative to the part above: they bend the flipper along its length
 *   legs          x: − forward, + back · z: sideways
 *
 * Gestures are written for the right side; `mirror` makes the left-hand version.
 */

import { BONES } from '../robotRig'
import type { BoneName } from '../robotRig'

export interface Angles {
  x: number
  y: number
  z: number
}

export type FullPose = Record<BoneName, Angles>
/** Only the bones and axes it names; the rest are untouched. */
export type PosePatch = Partial<Record<BoneName, Partial<Angles>>>

const AXES = ['x', 'y', 'z'] as const

export function restPose(): FullPose {
  return Object.fromEntries(BONES.map((bone) => [bone, { x: 0, y: 0, z: 0 }])) as FullPose
}

/** Adds `patch × weight` onto `pose`, in place. */
export function addPatch(pose: FullPose, patch: PosePatch, weight = 1) {
  for (const bone in patch) {
    const angles = patch[bone as BoneName]
    if (!angles) continue
    for (const axis of AXES) {
      const value = angles[axis]
      if (value !== undefined) pose[bone as BoneName][axis] += value * weight
    }
  }
}

const SWAP: Partial<Record<BoneName, BoneName>> = {
  upperArmL: 'upperArmR',
  upperArmR: 'upperArmL',
  foreArmL: 'foreArmR',
  foreArmR: 'foreArmL',
  handL: 'handR',
  handR: 'handL',
  legL: 'legR',
  legR: 'legL',
}

/** The same patch for the other side: left and right swap, sideways turns and tilts flip. */
export function mirror(patch: PosePatch): PosePatch {
  const out: PosePatch = {}
  for (const bone in patch) {
    const angles = patch[bone as BoneName]
    if (!angles) continue
    const flipped: Partial<Angles> = { ...angles }
    if (flipped.y !== undefined) flipped.y = -flipped.y
    if (flipped.z !== undefined) flipped.z = -flipped.z
    out[SWAP[bone as BoneName] ?? (bone as BoneName)] = flipped
  }
  return out
}
