/**
 * Gives the assistant robot a skeleton, at load time.
 *
 * The model is one solid mesh with no bones, so the joints and the skin
 * weights are worked out here from where each vertex sits:
 *
 *   hips ─ spine ─ head
 *     │      ├─ upperArmL ─ foreArmL ─ handL      (the flipper arms, split in three
 *     │      └─ upperArmR ─ foreArmR ─ handR       so they bend along their length)
 *     ├─ legL
 *     └─ legR
 *
 * Weights blend over a few millimetres around each joint, so bending stretches
 * the surface instead of tearing it.
 *
 * The landmarks were measured on public/models/assistant-robot.glb (0.22 units
 * tall, feet at y = 0) by slicing the mesh. Swapping the model means measuring
 * them again.
 */

import * as THREE from 'three'

/** In the model's own units: y up from the feet, x from the centre line (right side; mirrored for the left). */
const RIG = {
  /** Lower torso stays with the hips; above the waist it follows the spine. */
  waist: { y: 0.058, blend: [0.045, 0.075] },
  /** The head turns about the neck; everything above it follows the head. */
  neck: { y: 0.112, blend: [0.108, 0.118] },
  /** Arm joints along the flipper, which hangs from the shoulder to its tip at y ≈ 0.044. */
  shoulder: { x: 0.056, y: 0.094, z: 0.004 },
  elbow: { x: 0.063, y: 0.074, z: 0.004 },
  wrist: { x: 0.065, y: 0.057, z: 0.004 },
  /** Which vertices are arm: off the torso's side, within the flipper's thickness, below the shoulder. */
  arm: { innerX: [0.05, 0.055], top: [0.088, 0.1], bottom: 0.036, tipY: 0.044, z: [-0.016, 0.022] },
  /** Where along the arm (0 shoulder → 1 tip) the elbow and wrist bends blend. */
  bend: { elbow: [0.3, 0.48], wrist: [0.62, 0.8] },
  /** Legs: below the hips, split down the middle. */
  hip: { x: 0.024, y: 0.026, z: 0.004 },
  leg: { blend: [0.016, 0.032] },
  /** The crevice between arm and torso: hidden at rest, so its texture is a grey smear. */
  crevice: { x: [0.044, 0.06], y: [0.038, 0.1] },
  /** A plain cream spot on the torso's front, away from the badge, to paint the crevice with. */
  creamAt: { x: [0.03, 0.04], y: [0.045, 0.06] },
}

export const BONES = ['hips', 'spine', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'legL', 'legR'] as const
export type BoneName = (typeof BONES)[number]
const index = Object.fromEntries(BONES.map((name, i) => [name, i])) as Record<BoneName, number>

export interface RobotRig {
  /** The skinned robot, centred on its bounding box. */
  mesh: THREE.SkinnedMesh
  bones: Record<BoneName, THREE.Bone>
  /** Where the neck is, in the centred model's space (children of the head are placed relative to it). */
  neck: THREE.Vector3
  height: number
  dispose: () => void
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export function rigRobot(scene: THREE.Object3D): RobotRig {
  let source: THREE.Mesh | undefined
  scene.traverse((o) => {
    if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh
  })
  if (!source) throw new Error('rigRobot: the model has no mesh')

  // Bake the node transform (the file's quantisation scale and offset) into plain float positions.
  scene.updateMatrixWorld(true)
  const matrix = source.matrixWorld
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
  const srcPos = source.geometry.getAttribute('position')
  const srcNormal = source.geometry.getAttribute('normal')
  const count = srcPos.count
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(srcPos, i).applyMatrix4(matrix).toArray(position, i * 3)
    if (srcNormal) v.fromBufferAttribute(srcNormal, i).applyMatrix3(normalMatrix).normalize().toArray(normal, i * 3)
  }

  const box = new THREE.Box3().setFromArray(position)
  const centre = box.getCenter(new THREE.Vector3())
  const feet = box.min.y

  // Skin weights: up to four bones per vertex.
  const skinIndex = new Uint16Array(count * 4)
  const skinWeight = new Float32Array(count * 4)
  /** How much of each vertex belongs to an arm (0 body … 1 arm), for the crevice repaint below. */
  const armShare = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const x = position[i * 3] - centre.x
    const y = position[i * 3 + 1] - feet
    const z = position[i * 3 + 2] - centre.z
    const side = x < 0 ? 'L' : 'R'
    const influences: [BoneName, number][] = []

    const head = smoothstep(RIG.neck.blend[0], RIG.neck.blend[1], y)
    const inArmBand = y > RIG.arm.bottom && z > RIG.arm.z[0] && z < RIG.arm.z[1]
    const arm = inArmBand
      ? smoothstep(RIG.arm.innerX[0], RIG.arm.innerX[1], Math.abs(x)) * (1 - smoothstep(RIG.arm.top[0], RIG.arm.top[1], y))
      : 0
    const leg = 1 - smoothstep(RIG.leg.blend[0], RIG.leg.blend[1], y)

    if (head > 0) {
      influences.push(['head', head], ['spine', 1 - head])
    } else if (arm > 0) {
      // Along the flipper: shoulder → elbow → wrist, each bend blended.
      const along = THREE.MathUtils.clamp((RIG.shoulder.y - y) / (RIG.shoulder.y - RIG.arm.tipY), 0, 1)
      const pastElbow = smoothstep(RIG.bend.elbow[0], RIG.bend.elbow[1], along)
      const pastWrist = smoothstep(RIG.bend.wrist[0], RIG.bend.wrist[1], along)
      influences.push(
        ['spine', 1 - arm],
        [`upperArm${side}`, arm * (1 - pastElbow)],
        [`foreArm${side}`, arm * pastElbow * (1 - pastWrist)],
        [`hand${side}`, arm * pastWrist],
      )
      armShare[i] = arm
    } else if (leg > 0) {
      influences.push([`leg${side}`, leg], ['hips', 1 - leg])
    } else {
      const spine = smoothstep(RIG.waist.blend[0], RIG.waist.blend[1], y)
      influences.push(['spine', spine], ['hips', 1 - spine])
    }

    influences.forEach(([bone, weight], slot) => {
      skinIndex[i * 4 + slot] = index[bone]
      skinWeight[i * 4 + slot] = weight
    })
  }

  // Raising an arm opens the crevice it hid. Its inward-facing surface, and the band that stretches
  // across the shoulder, take the torso's cream instead of the smear the model was generated with.
  const srcUv = source.geometry.getAttribute('uv')
  const uv = srcUv ? new Float32Array(count * 2) : null
  if (srcUv && uv) {
    for (let i = 0; i < count; i++) {
      uv[i * 2] = srcUv.getX(i)
      uv[i * 2 + 1] = srcUv.getY(i)
    }
    let cream = -1
    let creamZ = -Infinity
    for (let i = 0; i < count; i++) {
      const x = position[i * 3] - centre.x
      const y = position[i * 3 + 1] - feet
      const z = position[i * 3 + 2]
      if (x > RIG.creamAt.x[0] && x < RIG.creamAt.x[1] && y > RIG.creamAt.y[0] && y < RIG.creamAt.y[1] && z > creamZ) {
        cream = i
        creamZ = z
      }
    }
    if (cream >= 0) {
      for (let i = 0; i < count; i++) {
        const x = position[i * 3] - centre.x
        const y = position[i * 3 + 1] - feet
        const facesBody = normal[i * 3] * Math.sign(x) < -0.2
        const stretches = armShare[i] > 0 && armShare[i] < 1
        const inCrevice = Math.abs(x) > RIG.crevice.x[0] && Math.abs(x) < RIG.crevice.x[1] && y > RIG.crevice.y[0] && y < RIG.crevice.y[1]
        if ((inCrevice && facesBody) || stretches) {
          uv[i * 2] = uv[cream * 2]
          uv[i * 2 + 1] = uv[cream * 2 + 1]
        }
      }
    }
  }

  // Centred like the rest of the scene expects.
  for (let i = 0; i < count; i++) {
    position[i * 3] -= centre.x
    position[i * 3 + 1] -= centre.y
    position[i * 3 + 2] -= centre.z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  if (srcNormal) geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  if (uv) geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(source.geometry.getIndex())
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))

  // Joints, placed in the centred space; each bone's position is relative to its parent's.
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y + feet - centre.y, z)
  const where: Record<BoneName, THREE.Vector3> = {
    hips: at(0, RIG.hip.y, 0),
    spine: at(0, RIG.waist.y, 0),
    head: at(0, RIG.neck.y, 0),
    upperArmL: at(-RIG.shoulder.x, RIG.shoulder.y, RIG.shoulder.z),
    foreArmL: at(-RIG.elbow.x, RIG.elbow.y, RIG.elbow.z),
    handL: at(-RIG.wrist.x, RIG.wrist.y, RIG.wrist.z),
    upperArmR: at(RIG.shoulder.x, RIG.shoulder.y, RIG.shoulder.z),
    foreArmR: at(RIG.elbow.x, RIG.elbow.y, RIG.elbow.z),
    handR: at(RIG.wrist.x, RIG.wrist.y, RIG.wrist.z),
    legL: at(-RIG.hip.x, RIG.hip.y, RIG.hip.z),
    legR: at(RIG.hip.x, RIG.hip.y, RIG.hip.z),
  }
  const parent: Partial<Record<BoneName, BoneName>> = {
    spine: 'hips',
    head: 'spine',
    upperArmL: 'spine',
    foreArmL: 'upperArmL',
    handL: 'foreArmL',
    upperArmR: 'spine',
    foreArmR: 'upperArmR',
    handR: 'foreArmR',
    legL: 'hips',
    legR: 'hips',
  }
  const bones = Object.fromEntries(
    BONES.map((name) => {
      const bone = new THREE.Bone()
      bone.name = name
      return [name, bone]
    }),
  ) as Record<BoneName, THREE.Bone>
  for (const name of BONES) {
    const up = parent[name]
    bones[name].position.copy(where[name]).sub(up ? where[up] : new THREE.Vector3())
    if (up) bones[up].add(bones[name])
  }

  const mesh = new THREE.SkinnedMesh(geometry, source.material)
  mesh.add(bones.hips)
  mesh.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(BONES.map((name) => bones[name])))
  // Limbs reach past the bind-pose bounds; one small mesh is cheaper to draw than to cull wrongly.
  mesh.frustumCulled = false

  return {
    mesh,
    bones,
    neck: where.head,
    height: box.max.y - box.min.y,
    dispose: () => {
      geometry.dispose()
      mesh.skeleton.dispose()
    },
  }
}
