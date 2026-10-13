/**
 * The robot's arms, built in code. The model's own are stubby flippers with no
 * elbows or hands: too short to fold, to reach its chin, or to give a
 * thumbs-up. These keep the flippers' look, one smooth, chubby cream limb
 * swelling out of the shoulder with no visible joints, but are long enough and
 * bend: the skin is weighted across the elbow and wrist, so it curves there
 * like a vinyl toy's arm, and ends in a mitten hand whose three plump fingers
 * sit pressed together (a mitten at rest) beside a plump thumb.
 *
 * Each arm is a chain of bones (shoulder → elbow → wrist, then two-jointed
 * fingers and a thumb); IK (motion/ik.ts) can place the hand.
 *
 * Lengths are in the model's units (it is 0.22 tall). Shoulder to fingertip is
 * about 0.095: hanging, the fingertips reach the hips; bent, the hands just meet
 * in front of the belly and reach the chin.
 *
 * Built for the right arm (+x, the viewer's right); the left mirrors it in x.
 * Hanging at rest, each arm points straight down with its palm facing the body
 * and its thumb forward (+z).
 */

import * as THREE from 'three'

export type Side = 'L' | 'R'
export const SIDES: Side[] = ['L', 'R']

export const ARM = {
  upper: 0.036,
  fore: 0.036,
  /** Wrist to the knuckles. */
  palm: 0.0118,
  /** Each finger's two segments, knuckle to tip. */
  finger: [0.0066, 0.0052],
  thumb: [0.0058, 0.0046],
}

/**
 * The limb's cross-sections from the top of the shoulder to the end of the palm:
 * [y from the shoulder joint, half-thickness (x), half-width (z, front to back)].
 * Like the flipper it replaces, it is deeper than it is thick and fattest at the
 * shoulder, where it sinks into the torso's side; it narrows all the way to the
 * wrist, then the palm spreads.
 */
const SHOULDER: [number, number] = [0.0165, 0.0186]
const SECTIONS: [number, number, number][] = [
  [0, ...SHOULDER],
  [-0.011, 0.0158, 0.0176],
  [-0.024, 0.0142, 0.0156],
  [-ARM.upper, 0.0128, 0.0138],
  [-ARM.upper - 0.014, 0.012, 0.0128],
  [-ARM.upper - 0.027, 0.0108, 0.0114],
  [-ARM.upper - ARM.fore, 0.0098, 0.0106],
  [-ARM.upper - ARM.fore - 0.0045, 0.0096, 0.0128],
  [-ARM.upper - ARM.fore - 0.009, 0.0094, 0.014],
]
/** How far above the joint the shoulder's dome rises, and how far past the last section the palm rounds off. */
const DOME = { shoulder: 0.016, palm: 0.006 }
/** How far the top of the limb leans into the torso, so the shoulder reads as part of the body rather than a ball beside it. */
const LEAN = { by: 0.0045, over: 0.03 }
/** Half the length, along the arm, over which the skin blends from one bone to the next. */
const BLEND = { elbow: 0.01, wrist: 0.0055 }

export interface HandBones {
  /** Per finger (index, middle, ring): the knuckle and the middle joint. */
  fingers: [THREE.Bone, THREE.Bone][]
  thumb: [THREE.Bone, THREE.Bone]
}

export interface ArmBones {
  upperArm: THREE.Bone
  foreArm: THREE.Bone
  hand: THREE.Bone
  fingers: HandBones
  /** Every bone of the arm, the three above first. */
  all: THREE.Bone[]
  /** The limb's skin, shoulder to palm. Add it beside the skeleton's root and call `bindSkin` once the bones are in place. */
  skin: THREE.SkinnedMesh
}

interface Parts {
  phalanx: THREE.BufferGeometry[]
  thumb: THREE.BufferGeometry[]
}

/** The fingers' geometries, shared by both hands. */
export function armParts(): Parts {
  return {
    phalanx: [capsule(0.0046, ARM.finger[0]), capsule(0.0044, ARM.finger[1])],
    thumb: [capsule(0.005, ARM.thumb[0]), capsule(0.0047, ARM.thumb[1])],
  }
}

export function disposeParts(parts: Parts) {
  for (const geometry of Object.values(parts).flat()) geometry.dispose()
}

/**
 * One arm's bones, with the fingers' parts on them and the limb's skin beside
 * them. `shoulder` is where it hangs from, in the space the skin will be added
 * to (the caller puts the shoulder bone there too).
 */
export function buildArm(side: Side, parts: Parts, material: THREE.Material, shoulder: THREE.Vector3): ArmBones {
  const s = side === 'R' ? 1 : -1
  const bone = (name: string, parent: THREE.Object3D | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone()
    b.name = `${name}${side}`
    b.position.set(x * s, y, z)
    parent?.add(b)
    return b
  }
  const part = (on: THREE.Object3D, geometry: THREE.BufferGeometry, y: number) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = y
    // Parts swing far from where they were built; culling them by a stale box is not worth it.
    mesh.frustumCulled = false
    on.add(mesh)
  }

  const upperArm = bone('upperArm', null, 0, 0, 0)
  const foreArm = bone('foreArm', upperArm, 0, -ARM.upper, 0)
  const hand = bone('hand', foreArm, 0, -ARM.fore, 0)

  // Three plump fingers side by side across the end of the palm, touching: index in front.
  const fingers: [THREE.Bone, THREE.Bone][] = [0.0088, 0, -0.0088].map((z, i) => {
    const knuckle = bone(`finger${i}a`, hand, -0.0004, -ARM.palm + 0.0012 - (i === 1 ? 0.0008 : 0), z)
    part(knuckle, parts.phalanx[0], -ARM.finger[0] / 2)
    const middle = bone(`finger${i}b`, knuckle, 0, -ARM.finger[0], 0)
    part(middle, parts.phalanx[1], -ARM.finger[1] / 2)
    return [knuckle, middle]
  })
  // The thumb grows from the front edge of the palm, a little towards the palm side.
  const thumbBase = bone('thumbA', hand, -0.002, -0.0046, 0.0112)
  part(thumbBase, parts.thumb[0], -ARM.thumb[0] / 2)
  const thumbTip = bone('thumbB', thumbBase, 0, -ARM.thumb[0], 0)
  part(thumbTip, parts.thumb[1], -ARM.thumb[1] / 2)

  const skin = new THREE.SkinnedMesh(limbGeometry(s).translate(shoulder.x, shoulder.y, shoulder.z), material)
  skin.name = `arm${side}`
  skin.frustumCulled = false

  return {
    upperArm,
    foreArm,
    hand,
    fingers: { fingers, thumb: [thumbBase, thumbTip] },
    all: [upperArm, foreArm, hand, ...fingers.flat(), thumbBase, thumbTip],
    skin,
  }
}

/** Binds the limb's skin to its three bones. Call with the arm hanging at rest and world matrices up to date. */
export function bindSkin(arm: ArmBones) {
  arm.skin.bind(new THREE.Skeleton([arm.upperArm, arm.foreArm, arm.hand]))
}

export function disposeArm(arm: ArmBones) {
  arm.skin.geometry.dispose()
  arm.skin.skeleton.dispose()
}

/**
 * The arms' material, made from the body's: the same finish in a flat cream
 * sampled off its texture (the arms have no UVs that fit it).
 */
export function armMaterial(body: THREE.Material, cream: THREE.Color): THREE.Material {
  const limb = body.clone() as THREE.MeshStandardMaterial
  for (const key of Object.keys(limb) as (keyof THREE.MeshStandardMaterial)[]) {
    if ((key === 'map' || key.endsWith('Map')) && key !== 'envMap') (limb as unknown as Record<string, unknown>)[key] = null
  }
  limb.color = cream.clone()
  limb.needsUpdate = true
  return limb
}

/**
 * The limb's skin, hanging from the origin: elliptical rings down SECTIONS, a
 * dome over the shoulder and a rounded end to the palm, weighted to
 * [upper arm, forearm, hand] (skin indices 0, 1, 2), blending across the elbow
 * and wrist. `s` is +1 for the right arm, −1 for the left.
 */
function limbGeometry(s: number) {
  const AROUND = 22
  // Rings: the shoulder's dome, the sections smoothed into a curve, then the palm's end.
  const rings: [number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    rings.push([DOME.shoulder * Math.cos(a), SHOULDER[0] * Math.sin(a), SHOULDER[1] * Math.sin(a)])
  }
  const curve = new THREE.CatmullRomCurve3(SECTIONS.map(([y, rx, rz]) => new THREE.Vector3(y, rx, rz)))
  for (const p of curve.getPoints(44)) rings.push([p.x, p.y, p.z])
  const [endY, endX, endZ] = SECTIONS.at(-1)!
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    rings.push([endY - DOME.palm * Math.sin(a), endX * Math.cos(a), endZ * Math.cos(a)])
  }

  const position: number[] = []
  const skinIndex: number[] = []
  const skinWeight: number[] = []
  const elbow = -ARM.upper
  const wrist = -ARM.upper - ARM.fore
  for (const [y, rx, rz] of rings) {
    const pastElbow = smoothstep(elbow + BLEND.elbow, elbow - BLEND.elbow, y)
    const pastWrist = smoothstep(wrist + BLEND.wrist, wrist - BLEND.wrist, y)
    const lean = -s * LEAN.by * smoothstep(-LEAN.over, 0, y)
    for (let j = 0; j < AROUND; j++) {
      const a = (j / AROUND) * Math.PI * 2
      // A pole's ring keeps a hair of radius, so its normals are defined.
      position.push(lean + Math.max(rx, 1e-5) * Math.cos(a), y, Math.max(rz, 1e-5) * Math.sin(a))
      skinIndex.push(0, 1, 2, 0)
      skinWeight.push(1 - pastElbow, pastElbow * (1 - pastWrist), pastElbow * pastWrist, 0)
    }
  }
  const index: number[] = []
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < AROUND; j++) {
      const a = i * AROUND + j
      const b = i * AROUND + ((j + 1) % AROUND)
      index.push(a, b, a + AROUND, b, b + AROUND, a + AROUND)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/** 0 at `a`, 1 at `b`, eased. */
function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** A capsule whose straight part is `length` long, centred on the origin along y. */
function capsule(radius: number, length: number) {
  return new THREE.CapsuleGeometry(radius, Math.max(0.0001, length - radius), 6, 14)
}
