/**
 * Gives the assistant robot a skeleton, at load time.
 *
 * The model is one solid mesh with no bones, so the body's joints and skin
 * weights are worked out here from where each vertex sits:
 *
 *   hips ─ spine ─ head
 *     │      ├─ upperArmL ─ foreArmL ─ handL ─ fingers, thumb   (robotArms.ts:
 *     │      └─ upperArmR ─ foreArmR ─ handR ─ fingers, thumb    built in code)
 *     ├─ legL
 *     └─ legR
 *
 * The model's own arms are stubby flippers. They are pressed flat into the
 * torso's sides (skinned to a bone squashed to nothing sideways) and longer
 * arms in the same style, with hands, take their place. Weights blend over a few millimetres
 * around each body joint, so bending stretches the surface instead of tearing it.
 *
 * The landmarks were measured on public/models/assistant-robot.glb (0.22 units
 * tall, feet at y = 0) by slicing the mesh. Swapping the model means measuring
 * them again.
 */

import * as THREE from 'three'

import { armMaterial, armParts, bindSkin, buildArm, disposeArm, disposeParts, SIDES } from './robotArms'
import type { ArmBones, HandBones, Side } from './robotArms'

/** In the model's own units: y up from the feet, x from the centre line (right side; mirrored for the left). */
const RIG = {
  /** Lower torso stays with the hips; above the waist it follows the spine. */
  waist: { y: 0.058, blend: [0.045, 0.075] },
  /** The head turns about the neck; everything above it follows the head. */
  neck: { y: 0.112, blend: [0.108, 0.118] },
  /** Where the new arms hang from, and where the old flippers fold away to. */
  shoulder: { x: 0.058, y: 0.093, z: 0.004 },
  /** Which vertices are the old flipper: off the torso's side, within its thickness, below the shoulder. */
  flipper: { innerX: [0.05, 0.055], top: [0.088, 0.1], bottom: 0.036, z: [-0.016, 0.022] },
  /** The plane, just inside the torso's side, that the flippers are pressed flat against. */
  flatX: 0.046,
  /** Legs: below the hips, split down the middle. */
  hip: { x: 0.024, y: 0.026, z: 0.004 },
  leg: { blend: [0.016, 0.032] },
  /** The crevice between flipper and torso: hidden until now, so its texture is a grey smear. */
  crevice: { x: [0.044, 0.06], y: [0.038, 0.1] },
  /** A plain cream spot on the torso's front, away from the badge, to paint the crevice with. */
  creamAt: { x: [0.03, 0.04], y: [0.045, 0.06] },
  /** The torso's front either side of the badge, whose average colour the arms take. */
  skinAt: { x: [0.022, 0.046], y: [0.04, 0.1], z: 0.015 },
}

/** The bones the motion system poses with angles (motion/pose.ts); the fingers have their own controls (motion/hands.ts). */
export const BONES = ['hips', 'spine', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'legL', 'legR'] as const
export type BoneName = (typeof BONES)[number]

/** The bones the body's vertices are skinned to, in skeleton order. */
const SKIN = ['hips', 'spine', 'head', 'legL', 'legR', 'stubL', 'stubR'] as const
type SkinBone = (typeof SKIN)[number]
const SKIN_INDEX = Object.fromEntries(SKIN.map((name, i) => [name, i])) as Record<SkinBone, number>

export interface RobotRig {
  /** The skinned robot, centred on its bounding box. */
  mesh: THREE.SkinnedMesh
  bones: Record<BoneName, THREE.Bone>
  hands: Record<Side, HandBones>
  /** Where IK sends each wrist (motion/ik.ts): bones in the skeleton, moved each frame. */
  reach: Record<Side, THREE.Bone>
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
  /** How much of each vertex belongs to a flipper (0 body … 1 flipper), for the crevice repaint below. */
  const armShare = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const x = position[i * 3] - centre.x
    const y = position[i * 3 + 1] - feet
    const z = position[i * 3 + 2] - centre.z
    const side = x < 0 ? 'L' : 'R'
    const influences: [SkinBone, number][] = []

    const head = smoothstep(RIG.neck.blend[0], RIG.neck.blend[1], y)
    const inFlipper = y > RIG.flipper.bottom && z > RIG.flipper.z[0] && z < RIG.flipper.z[1]
    const arm = inFlipper
      ? smoothstep(RIG.flipper.innerX[0], RIG.flipper.innerX[1], Math.abs(x)) * (1 - smoothstep(RIG.flipper.top[0], RIG.flipper.top[1], y))
      : 0
    const leg = 1 - smoothstep(RIG.leg.blend[0], RIG.leg.blend[1], y)

    if (head > 0) {
      influences.push(['head', head], ['spine', 1 - head])
    } else if (arm > 0) {
      // The flipper is pressed flat into the torso's side.
      influences.push(['spine', 1 - arm], [`stub${side}`, arm])
      armShare[i] = arm
    } else if (leg > 0) {
      influences.push([`leg${side}`, leg], ['hips', 1 - leg])
    } else {
      const spine = smoothstep(RIG.waist.blend[0], RIG.waist.blend[1], y)
      influences.push(['spine', spine], ['hips', 1 - spine])
    }

    influences.forEach(([bone, weight], slot) => {
      skinIndex[i * 4 + slot] = SKIN_INDEX[bone]
      skinWeight[i * 4 + slot] = weight
    })
  }

  // Folding a flipper away opens the crevice it hid. Its inward-facing surface, and the band that
  // stretches across the shoulder, take the torso's cream instead of the smear the model was generated with.
  const srcUv = source.geometry.getAttribute('uv')
  const uv = srcUv ? new Float32Array(count * 2) : null
  let creamUv: [number, number] | null = null
  const torsoUvs: [number, number][] = []
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
      // The torso's front, either side of the badge: what the arms should match.
      const ax = Math.abs(x)
      if (ax > RIG.skinAt.x[0] && ax < RIG.skinAt.x[1] && y > RIG.skinAt.y[0] && y < RIG.skinAt.y[1] && z - centre.z > RIG.skinAt.z) {
        torsoUvs.push([uv[i * 2], uv[i * 2 + 1]])
      }
    }
    if (cream >= 0) {
      creamUv = [uv[cream * 2], uv[cream * 2 + 1]]
      for (let i = 0; i < count; i++) {
        const x = position[i * 3] - centre.x
        const y = position[i * 3 + 1] - feet
        const facesBody = normal[i * 3] * Math.sign(x) < -0.2
        const stretches = armShare[i] > 0 && armShare[i] < 1
        const inCrevice = Math.abs(x) > RIG.crevice.x[0] && Math.abs(x) < RIG.crevice.x[1] && y > RIG.crevice.y[0] && y < RIG.crevice.y[1]
        if ((inCrevice && facesBody) || stretches) {
          uv[i * 2] = creamUv[0]
          uv[i * 2 + 1] = creamUv[1]
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
  const waist = at(0, RIG.waist.y, 0)
  const shoulder = (side: Side) => at(RIG.shoulder.x * (side === 'R' ? 1 : -1), RIG.shoulder.y, RIG.shoulder.z).sub(waist)
  const bone = (name: string, parent: THREE.Object3D | null, position: THREE.Vector3) => {
    const b = new THREE.Bone()
    b.name = name
    b.position.copy(position)
    parent?.add(b)
    return b
  }
  const hips = bone('hips', null, at(0, RIG.hip.y, 0))
  const spine = bone('spine', hips, waist.clone().sub(hips.position))
  const head = bone('head', spine, at(0, RIG.neck.y, 0).sub(waist))
  const legL = bone('legL', hips, at(-RIG.hip.x, RIG.hip.y, RIG.hip.z).sub(hips.position))
  const legR = bone('legR', hips, at(RIG.hip.x, RIG.hip.y, RIG.hip.z).sub(hips.position))
  const stubL = bone('stubL', spine, at(-RIG.flatX, RIG.shoulder.y, RIG.shoulder.z).sub(waist))
  const stubR = bone('stubR', spine, at(RIG.flatX, RIG.shoulder.y, RIG.shoulder.z).sub(waist))

  const body = source.material as THREE.MeshStandardMaterial
  const cream = textureColor(body.map, torsoUvs) ?? new THREE.Color('#efe4bd')
  const limb = armMaterial(body, cream)
  const parts = armParts()
  const arms = {} as Record<Side, ArmBones>
  for (const side of SIDES) {
    arms[side] = buildArm(side, parts, limb, shoulder(side).add(waist))
    arms[side].upperArm.position.copy(shoulder(side))
    spine.add(arms[side].upperArm)
  }
  const reach = { L: bone('reachL', null, new THREE.Vector3()), R: bone('reachR', null, new THREE.Vector3()) }

  const bones: Record<BoneName, THREE.Bone> = {
    hips,
    spine,
    head,
    legL,
    legR,
    upperArmL: arms.L.upperArm,
    foreArmL: arms.L.foreArm,
    handL: arms.L.hand,
    upperArmR: arms.R.upperArm,
    foreArmR: arms.R.foreArm,
    handR: arms.R.hand,
  }
  // The skeleton: the bones the body is skinned to first, in SKIN order, then the arms and the IK targets.
  const skinned: Record<SkinBone, THREE.Bone> = { hips, spine, head, legL, legR, stubL, stubR }
  const all = [...SKIN.map((name) => skinned[name]), ...arms.L.all, ...arms.R.all, reach.L, reach.R]

  const mesh = new THREE.SkinnedMesh(geometry, body)
  mesh.add(hips, reach.L, reach.R)
  mesh.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(all))
  // The arms' skins sit beside the bones, each bound to its own three.
  for (const side of SIDES) {
    mesh.add(arms[side].skin)
    bindSkin(arms[side])
  }
  // Squashed only after binding, so the bind pose keeps them full size: the flippers press flat
  // against the torso's side, a patch over where they grew from, under the new arms.
  stubL.scale.x = 1e-4
  stubR.scale.x = 1e-4
  // Limbs reach past the bind-pose bounds; one small mesh is cheaper to draw than to cull wrongly.
  mesh.frustumCulled = false

  return {
    mesh,
    bones,
    hands: { L: arms.L.fingers, R: arms.R.fingers },
    reach,
    neck: at(0, RIG.neck.y, 0),
    height: box.max.y - box.min.y,
    dispose: () => {
      geometry.dispose()
      mesh.skeleton.dispose()
      for (const side of SIDES) disposeArm(arms[side])
      disposeParts(parts)
      limb.dispose()
    },
  }
}

/** The texture's colour averaged over the points `uvs`, read off a small copy of it. */
function textureColor(texture: THREE.Texture | null, uvs: [number, number][]): THREE.Color | null {
  const image = texture?.image as (CanvasImageSource & { width: number }) | undefined
  if (!image?.width || !uvs.length) return null
  const SIZE = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, SIZE, SIZE)
  const { data } = context.getImageData(0, 0, SIZE, SIZE)
  const sum = [0, 0, 0]
  for (const [u, v] of uvs) {
    // glTF textures are not flipped: v runs down the image.
    const pixel = (Math.min(SIZE - 1, Math.floor(v * SIZE)) * SIZE + Math.min(SIZE - 1, Math.floor(u * SIZE))) * 4
    for (let c = 0; c < 3; c++) sum[c] += data[pixel + c]
  }
  const [r, g, b] = sum.map((total) => total / uvs.length / 255)
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace)
}
