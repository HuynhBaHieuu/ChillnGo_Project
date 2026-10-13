/**
 * Reaching: puts a wrist on a point (under the chin, on a cheek, at the side
 * of the head, across the belly) with three.js's CCDIKSolver. It runs after the
 * springs have posed the arm, starting from that pose, so the elbow stays about
 * where the gesture's keys put it and the solver only closes the gap; its
 * result is blended in by the gesture's weight, so an arm eases onto and off
 * its goal. The goal is given in a bone's space (the head, the spine), so a
 * hand under the chin follows the head as it tilts.
 *
 * A goal can also say how the hand lies there (`lay`: which way the fingers
 * point and the palm faces, in the same bone's space), so a palm stays flat on
 * a cheek whichever way the arm had to bend to reach it.
 *
 * The elbow is a hinge that only bends one way; the shoulder is kept to a range
 * an arm could reach without passing through the body.
 */

import * as THREE from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { Side } from '../robotArms'
import type { RobotRig } from '../robotRig'

export interface Reach {
  /** The bone `at` is given in. */
  ref: 'head' | 'spine'
  /** Where the wrist goes, in that bone's space (model units). */
  at: readonly [number, number, number]
  /** How the hand lies there, in that bone's space: the way its fingers point and the way its palm faces. */
  lay?: { fingers: readonly [number, number, number]; palm: readonly [number, number, number] }
  /** 0 (the gesture's own pose) … 1 (on the goal). */
  weight: number
}

const point = new THREE.Vector3()
const fingers = new THREE.Vector3()
const palm = new THREE.Vector3()
const thumb = new THREE.Vector3()
const basis = new THREE.Matrix4()
const lay = new THREE.Quaternion()
const world = new THREE.Quaternion()

export class ArmReach {
  private readonly solver: CCDIKSolver
  private readonly iks: Record<Side, IK>
  private readonly rig: RobotRig

  constructor(rig: RobotRig) {
    this.rig = rig
    const index = (bone: THREE.Bone) => rig.mesh.skeleton.bones.indexOf(bone)
    const chain = (side: Side): IK => {
      // z swings the arm out (+ for the right arm, − for the left) or across the body.
      const [zMin, zMax] = side === 'R' ? [-1.3, 2.9] : [-2.9, 1.3]
      return {
        target: index(rig.reach[side]),
        effector: index(rig.bones[`hand${side}`]),
        iteration: 10,
        links: [
          // Elbow: bends forward only, and never quite straight (a straight hinge leaves CCD nothing to turn).
          {
            index: index(rig.bones[`foreArm${side}`]),
            limitation: new THREE.Vector3(1, 0, 0),
            rotationMin: new THREE.Vector3(-2.6, 0, 0),
            rotationMax: new THREE.Vector3(-0.05, 0, 0),
          },
          // Shoulder: up and out freely, across the body only so far, a limited twist.
          {
            index: index(rig.bones[`upperArm${side}`]),
            rotationMin: new THREE.Vector3(-3, -1, zMin),
            rotationMax: new THREE.Vector3(1, 1, zMax),
          },
        ],
      }
    }
    this.iks = { L: chain('L'), R: chain('R') }
    this.solver = new CCDIKSolver(rig.mesh, [this.iks.L, this.iks.R])
  }

  /** Call once the bones have this frame's pose. */
  apply(goals: Partial<Record<Side, Reach>>) {
    let updated = false
    for (const side of ['L', 'R'] as const) {
      const goal = goals[side]
      if (!goal || goal.weight <= 0.001) continue
      if (!updated) {
        this.rig.mesh.updateMatrixWorld(true)
        updated = true
      }
      const target = this.rig.reach[side]
      this.rig.bones[goal.ref].localToWorld(point.set(goal.at[0], goal.at[1], goal.at[2]))
      target.position.copy(this.rig.mesh.worldToLocal(point))
      target.updateMatrixWorld()
      const weight = Math.min(1, goal.weight)
      this.iks[side].blendFactor = weight
      this.solver.updateOne(this.iks[side])
      if (goal.lay) this.layHand(side, goal.ref, goal.lay, weight)
    }
  }

  /**
   * Turns the hand so its fingers point along `fingers` and its palm faces `palm` (both in `ref`'s
   * space). At rest a hand's fingers run along −y, its thumb along +z, and its palm faces the body:
   * −x for the right hand, +x for the left (robotArms.ts).
   */
  private layHand(side: Side, ref: Reach['ref'], to: NonNullable<Reach['lay']>, weight: number) {
    const hand = this.rig.bones[`hand${side}`]
    fingers.set(to.fingers[0], to.fingers[1], to.fingers[2]).normalize()
    // The palm's direction, squared up against the fingers'.
    palm.set(to.palm[0], to.palm[1], to.palm[2])
    palm.addScaledVector(fingers, -palm.dot(fingers)).normalize()
    const x = side === 'R' ? palm.negate() : palm
    const y = fingers.negate()
    basis.makeBasis(x, y, thumb.crossVectors(x, y))
    // In the world: the reference bone's turn, then this; then into the forearm's space, which the hand hangs in.
    lay.setFromRotationMatrix(basis).premultiply(this.rig.bones[ref].getWorldQuaternion(world))
    lay.premultiply(this.rig.bones[`foreArm${side}`].getWorldQuaternion(world).invert())
    hand.quaternion.slerp(lay, weight)
  }
}
