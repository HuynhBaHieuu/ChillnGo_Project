/**
 * The assistant's 3D robot, standing in the corner beside the chat bubble.
 *
 * Loaded on demand (it brings three.js with it), only when the chat opens.
 * The model has no rig of its own: robotRig.ts gives it a skeleton, and longer
 * arms with hands in the style of its own (robotArms.ts), at load time. Each frame:
 *
 *   1. its joints follow, through springs (motion/springs.ts), the sum of a
 *      posture for the conversational state, the small movements of something
 *      alive (motion/postures.ts), and whatever gestures the director
 *      (motion/director.ts) has chosen from the conversation;
 *   2. its fingers follow the hand shapes of the posture and the gestures
 *      (motion/hands.ts);
 *   3. IK puts a wrist where a gesture wants it, under the chin or on a cheek
 *      (motion/ik.ts).
 *
 * A new screen laid over the painted one, riding on the head bone, shows the eyes.
 *
 * Swapping the model: replace public/models/assistant-robot.glb and re-measure
 * SCREEN (where its face screen sits) and the joints in robotRig.ts.
 */

import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode, RefObject } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import type { AssistantIntent } from './replyTags'

import { GestureDirector } from './motion/director'
import { HANDS, HandSprings, mixShape, poseHand } from './motion/hands'
import { ArmReach } from './motion/ik'
import { addPatch, restPose } from './motion/pose'
import { handsFor, lifeMotion, postureFor } from './motion/postures'
import { JointSprings } from './motion/springs'
import type { Cue } from './replyTags'
import { SIDES } from './robotArms'
import { RobotFace } from './RobotFace'
import type { RobotMood } from './robotMood'
import { BONES, rigRobot } from './robotRig'
import type { RobotRig } from './robotRig'

const MODEL_URL = `${import.meta.env.BASE_URL}models/assistant-robot.glb`

/**
 * The face screen, in the model's own units with the model centred on its
 * bounding box (it is 0.22 tall). Measured by ray-casting the painted screen;
 * z sits just in front of the painted eyes, which bulge out slightly.
 */
const SCREEN = { x: -0.0025, y: 0.057, z: 0.0572, width: 0.118, height: 0.082, radius: 0.016 }
const EYE_GAP = 0.025
const EYE_COLOR = '#eafcff'

export interface AssistantRobotProps {
  mood: RobotMood
  /** The reply in progress: its id (so a new reply is noticed even with the same intent)… */
  replyId: number | null
  /** …what it is doing: undefined until its opening has arrived, null when the model gave no tag… */
  intent: AssistantIntent | null | undefined
  /** …its gesture cues (stressed words, a thumbs-up, list points, sentence ends)… */
  cues: Cue[]
  /** …and how many of them are due, as the reply is said. */
  due: number
  /** Fires once the model is loaded and on screen, so a greeting is not spent while it loads. */
  onReady?: () => void
}

export default function AssistantRobot(props: AssistantRobotProps) {
  return (
    <RobotBoundary fallback={<RobotFace mood={props.mood} className="mx-auto mt-[22%] w-3/4" />}>
      {/* Pointer events come from the whole page, so the robot looks towards the cursor wherever it is.
          offsetSize: measure the layout box, not getBoundingClientRect, so a CSS transform on
          an ancestor (an enter animation) can never shrink the canvas to its mid-animation size. */}
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 30, position: [0, 0.08, 5.3] }}
        eventSource={document.body}
        eventPrefix="client"
        resize={{ offsetSize: true }}
      >
        <StudioLight />
        <Suspense fallback={null}>
          <Robot {...props} />
        </Suspense>
      </Canvas>
    </RobotBoundary>
  )
}

/** Soft product-shot reflections from three's built-in room, no HDRI download. */
function StudioLight() {
  const gl = useThree((three) => three.gl)
  const environment = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const texture = pmrem.fromScene(room, 0.04).texture
    room.dispose()
    pmrem.dispose()
    return texture
  }, [gl])
  useEffect(() => () => environment.dispose(), [environment])
  return <primitive object={environment} attach="environment" />
}

const seconds = () => performance.now() / 1000

function Robot({ mood, replyId, intent, cues, due, onReady }: AssistantRobotProps) {
  const gltf = useLoader(GLTFLoader, MODEL_URL)
  // Mounted only after the model has loaded (Suspense), so this is the moment it appears.
  useEffect(() => onReady?.(), [onReady])
  const pivot = useRef<THREE.Group>(null)
  const reduced = useReducedMotion()
  const appear = useRef(0)
  /** Where the eyes look, in screen units; shared with the screen. */
  const gaze = useRef({ x: 0, y: 0 })
  /** A face a gesture asks for (scratching its head looks confused), shown instead of the mood's. */
  const [gestureFace, setGestureFace] = useState<RobotMood | null>(null)
  const shownFace = useRef<RobotMood | null>(null)

  // The conversation drives the gestures; the director decides which and when.
  const [director] = useState(() => new GestureDirector(reduced))
  const [springs] = useState(() => new JointSprings())
  const [fingers] = useState(() => new HandSprings())
  useEffect(() => director.setMood(mood, seconds()), [director, mood])
  useEffect(() => {
    // Waits for the reply's opening, so the thinking pose is not cut short at send.
    if (replyId !== null && intent !== undefined) director.startReply(intent, seconds())
  }, [director, replyId, intent])
  // Each cue once, as it falls due.
  const delivered = useRef({ replyId: null as number | null, count: 0 })
  useEffect(() => {
    if (delivered.current.replyId !== replyId) delivered.current = { replyId, count: 0 }
    for (const cue of cues.slice(delivered.current.count, due)) director.cue(cue, seconds())
    delivered.current.count = Math.max(delivered.current.count, due)
  }, [director, replyId, cues, due])
  // Development: try any gesture from the console, e.g. __assistantRobot.play('thumbsUp').
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as { __assistantRobot?: GestureDirector }
    w.__assistantRobot = director
    return () => void delete w.__assistantRobot
  }, [director])

  // Rigged, centred on its bounding box, and scaled to 2 units tall whatever the file's units.
  const rig = useMemo(() => rigRobot(gltf.scene), [gltf])
  // The frame loop moves the bones through a ref, not through the memoised rig.
  const live = useRef<{ bones: RobotRig['bones']; hands: RobotRig['hands']; reach: ArmReach } | null>(null)
  useEffect(() => {
    live.current = { bones: rig.bones, hands: rig.hands, reach: new ArmReach(rig) }
    return () => {
      live.current = null
      rig.dispose()
    }
  }, [rig])
  const scale = 2 / rig.height

  useFrame((state, delta) => {
    const body = pivot.current
    const rigged = live.current
    if (!body || !rigged) return
    const t = state.clock.elapsedTime
    // The pointer is measured against this small canvas, so anywhere else on the page it runs far past ±1.
    const px = THREE.MathUtils.clamp(state.pointer.x, -1.6, 1.6) / 1.6
    const py = THREE.MathUtils.clamp(state.pointer.y, -1.2, 1.2) / 1.2
    const awake = mood !== 'sleepy'

    // Posture for the state, the small movements of something alive, then the gestures on top.
    const frame = director.frame(seconds())
    const target = restPose()
    addPatch(target, postureFor(mood, frame.arms))
    if (!reduced) addPatch(target, lifeMotion(t, mood))
    addPatch(target, frame.offsets)
    // The head turns to the pointer more than the body does.
    if (awake) {
      target.head.y += px * 0.3
      target.head.x -= py * 0.08
    }
    springs.step(target, delta, reduced)
    for (const name of BONES) {
      const { x, y, z } = springs.value[name]
      rigged.bones[name].rotation.set(x, y, z)
    }

    // The fingers: the resting shape, the gestures' shapes over it.
    const hands = handsFor(mood, reduced ? 0 : t)
    for (const { side, shape, weight } of frame.hands) mixShape(hands[side], HANDS[shape], weight)
    fingers.step(hands, delta)
    for (const side of SIDES) poseHand(rigged.hands[side], fingers.value[side], side)
    // Last, hands that should touch something (chin, cheek, the other arm) are put there.
    rigged.reach.apply(frame.reach)

    gaze.current.x = awake ? px * 0.006 + frame.gaze.x : 0
    gaze.current.y = awake ? py * 0.004 + frame.gaze.y : 0
    if (frame.face !== shownFace.current) {
      shownFace.current = frame.face
      setGestureFace(frame.face)
    }
    // What it is doing, readable from outside (tests, devtools):
    // <canvas data-gestures="nod thinkChin" data-hands="R:cup L:flat">.
    const canvas = state.gl.domElement
    const playing = director.active().join(' ')
    if (canvas.dataset.gestures !== playing) canvas.dataset.gestures = playing
    const shapes = frame.hands.filter((h) => h.weight > 0.5).map((h) => `${h.side}:${h.shape}`).join(' ')
    if (canvas.dataset.hands !== shapes) canvas.dataset.hands = shapes

    // The whole body only turns a little towards the pointer; the joints do the rest.
    // It pops in when the chat opens, inside the scene rather than with a CSS transform on the page.
    appear.current = Math.min(1, appear.current + delta / 0.4)
    body.scale.setScalar(reduced ? 1 : 0.4 + 0.6 * easeOutBack(appear.current))
    const ease = 1 - Math.exp(-delta * 4)
    body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, awake ? px * 0.22 : 0, ease)
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, awake ? -py * 0.05 : 0, ease)
  })

  return (
    <group ref={pivot}>
      <group scale={scale}>
        <primitive object={rig.mesh} />
        {/* The face rides on the head bone, so it nods, tilts and shakes with the head. */}
        {createPortal(<Screen mood={gestureFace ?? mood} reduced={reduced} gaze={gaze} neck={rig.neck} />, rig.bones.head)}
      </group>
    </group>
  )
}

const BLINKS: RobotMood[] = ['idle', 'listening', 'speaking']

/** A fresh black screen over the painted one, and the face for this mood on it. */
interface ScreenProps {
  mood: RobotMood
  reduced: boolean
  gaze: RefObject<{ x: number; y: number }>
  /** The head bone's position: the screen is placed relative to it. */
  neck: THREE.Vector3
}

function Screen({ mood, reduced, gaze, neck }: ScreenProps) {
  const eyes = useRef<THREE.Group>(null)
  const dots = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Group>(null)
  const nextBlink = useRef(2)
  /** Where the eyes are resting, and until when. */
  const fixation = useRef({ x: 0, y: 0, until: 0 })
  const outline = useMemo(() => roundedRect(SCREEN.width, SCREEN.height, SCREEN.radius), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const face = eyes.current
    if (face) {
      let sx = 1
      let sy = 1
      if (!reduced && BLINKS.includes(mood)) {
        if (t > nextBlink.current + 0.14) nextBlink.current = t + 2.5 + Math.random() * 3
        if (t > nextBlink.current) sy = 0.12
      }
      if (!reduced && mood === 'speaking') sy *= 1 - Math.abs(Math.sin(t * 9)) * 0.25
      if (!reduced && mood === 'love') sx = sy = 1 + 0.15 * Math.abs(Math.sin(t * 4)) // beating hearts
      face.scale.set(sx, sy, 1)
      // Eyes jump to a point and rest there rather than gliding: when what it looks at has moved
      // away, or after a moment, to a point just off it. A long jump sometimes takes a blink with it.
      const rest = fixation.current
      const away = Math.hypot(gaze.current.x - rest.x, gaze.current.y - rest.y)
      if (away > 0.0018 || t > rest.until) {
        const drift = reduced ? 0 : 0.0012
        rest.x = gaze.current.x + (Math.random() - 0.5) * drift
        rest.y = gaze.current.y + (Math.random() - 0.5) * drift * 0.6
        rest.until = t + 0.5 + Math.random() * 1.8
        if (!reduced && away > 0.005 && BLINKS.includes(mood) && Math.random() < 0.4) nextBlink.current = t
      }
      face.position.x = THREE.MathUtils.lerp(face.position.x, rest.x, 0.45)
      face.position.y = THREE.MathUtils.lerp(face.position.y, rest.y, 0.45)
    }
    // Wrapper groups carry the animated scale, so the shapes inside keep their own size.
    dots.current?.children.forEach((dot, i) => dot.scale.setScalar(reduced ? 1 : 0.6 + 0.4 * Math.max(0, Math.sin(t * 5 - i * 0.9))))
    if (mouth.current) mouth.current.scale.y = reduced ? 0.6 : 0.25 + 0.75 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3 + 1))
  })

  return (
    <group position={[SCREEN.x - neck.x, SCREEN.y - neck.y, SCREEN.z - neck.z]}>
      <mesh>
        <shapeGeometry args={[outline, 12]} />
        {/* Deep black, no reflections: facing the camera, any room reflection washes the screen grey. */}
        <meshBasicMaterial color="#030405" />
      </mesh>
      <group ref={eyes} position-z={0.0004}>
        {mood === 'listening' && (
          <>
            <Oval x={-EYE_GAP} rx={0.011} ry={0.012} />
            <Oval x={EYE_GAP} rx={0.011} ry={0.012} />
          </>
        )}
        {mood === 'thinking' && (
          <>
            <Oval x={-EYE_GAP + 0.007} y={0.01} rx={0.0068} ry={0.0085} />
            <Oval x={EYE_GAP + 0.007} y={0.01} rx={0.0068} ry={0.0085} />
          </>
        )}
        {mood === 'success' && (
          <>
            <Arc x={-EYE_GAP} />
            <Oval x={EYE_GAP} rx={0.0105} ry={0.0105} />
          </>
        )}
        {mood === 'error' && (
          <>
            <Bar x={-EYE_GAP} y={0.005} angle={-0.5} />
            <Bar x={-EYE_GAP} y={-0.005} angle={0.5} />
            <Bar x={EYE_GAP} y={0.005} angle={0.5} />
            <Bar x={EYE_GAP} y={-0.005} angle={-0.5} />
          </>
        )}
        {(mood === 'idle' || mood === 'speaking') && (
          <>
            <Oval x={-EYE_GAP} rx={0.0072} ry={0.0125} />
            <Oval x={EYE_GAP} rx={0.0072} ry={0.0125} />
          </>
        )}
        {mood === 'happy' && (
          <>
            <Arc x={-EYE_GAP} />
            <Arc x={EYE_GAP} />
          </>
        )}
        {mood === 'love' && (
          <>
            <Heart x={-EYE_GAP} />
            <Heart x={EYE_GAP} />
          </>
        )}
        {mood === 'surprised' && (
          <>
            <Oval x={-EYE_GAP} y={0.004} rx={0.0125} ry={0.0135} />
            <Oval x={EYE_GAP} y={0.004} rx={0.0125} ry={0.0135} />
          </>
        )}
        {mood === 'sleepy' && (
          <>
            <Bar x={-EYE_GAP} y={-0.004} angle={0} />
            <Bar x={EYE_GAP} y={-0.004} angle={0} />
          </>
        )}
        {mood === 'confused' && (
          <>
            {/* One eye wide, one squinting: puzzled. */}
            <Oval x={-EYE_GAP} y={0.003} rx={0.0095} ry={0.0105} />
            <Oval x={EYE_GAP} y={-0.002} rx={0.0075} ry={0.0045} />
          </>
        )}
      </group>
      {mood === 'love' && (
        <>
          <Blush x={-EYE_GAP - 0.011} />
          <Blush x={EYE_GAP + 0.011} />
        </>
      )}
      {mood === 'speaking' && (
        <group ref={mouth} position={[0, -0.025, 0.0004]}>
          <Oval x={0} rx={0.0065} ry={0.0045} />
        </group>
      )}
      {mood === 'surprised' && (
        <mesh position={[0, -0.026, 0.0004]}>
          <torusGeometry args={[0.0042, 0.0015, 10, 28]} />
          <Glow />
        </mesh>
      )}
      {mood === 'sleepy' && <Snore reduced={reduced} />}
      {mood === 'confused' && <QuestionMark />}
      {mood === 'thinking' && (
        <group ref={dots} position={[0, -0.024, 0.0004]}>
          {[-0.01, 0, 0.01].map((x) => (
            <group key={x} position-x={x}>
              <Oval x={0} rx={0.0022} ry={0.0022} />
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

function Glow() {
  return <meshBasicMaterial color={EYE_COLOR} toneMapped={false} />
}

function Oval({ x, y = 0, rx, ry }: { x: number; y?: number; rx: number; ry: number }) {
  return (
    <mesh position={[x, y, 0]} scale={[rx, ry, 1]}>
      <circleGeometry args={[1, 40]} />
      <Glow />
    </mesh>
  )
}

/** A closed, smiling eye: ◠ */
function Arc({ x }: { x: number }) {
  return (
    <mesh position={[x, -0.004, 0]}>
      <torusGeometry args={[0.0105, 0.0024, 12, 32, Math.PI]} />
      <Glow />
    </mesh>
  )
}

/** Half of a > or < eye. */
function Bar({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <mesh position={[x, y, 0]} rotation-z={angle}>
      <planeGeometry args={[0.016, 0.0048]} />
      <Glow />
    </mesh>
  )
}

const HEART = heartShape()

/** A heart-shaped eye, pink. */
function Heart({ x }: { x: number }) {
  return (
    <mesh position={[x, 0, 0]} rotation-z={Math.PI} scale={0.00062}>
      <shapeGeometry args={[HEART, 16]} />
      <meshBasicMaterial color="#ff7aa8" toneMapped={false} />
    </mesh>
  )
}

/** A blushing cheek, under and outside an eye. */
function Blush({ x }: { x: number }) {
  return (
    <mesh position={[x, -0.017, 0.0004]} scale={[0.0088, 0.0046, 1]}>
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial color="#ff7aa8" toneMapped={false} transparent opacity={0.6} />
    </mesh>
  )
}

const Z = zShape()

/** "z z z" rising from the screen's top-right corner and fading, while it dozes. */
function Snore({ reduced }: { reduced: boolean }) {
  const letters = useRef<THREE.Group>(null)
  useFrame((state) => {
    letters.current?.children.forEach((letter, i) => {
      const phase = reduced ? 0.5 : (state.clock.elapsedTime * 0.45 + i / 3) % 1
      letter.position.set(0.028 + phase * 0.012 + i * 0.002, 0.004 + phase * 0.026, 0.0004)
      letter.scale.setScalar(0.004 + phase * 0.004)
      const material = (letter as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = Math.sin(phase * Math.PI)
    })
  })
  return (
    <group ref={letters}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <shapeGeometry args={[Z]} />
          <meshBasicMaterial color={EYE_COLOR} toneMapped={false} transparent />
        </mesh>
      ))}
    </group>
  )
}

/** A "?" in the screen's top-right corner: a hook, a short stem and a dot. */
function QuestionMark() {
  return (
    <group position={[0.036, 0.012, 0.0004]}>
      <mesh rotation-z={-0.35 * Math.PI}>
        <torusGeometry args={[0.0045, 0.0013, 10, 24, 1.35 * Math.PI]} />
        <Glow />
      </mesh>
      <mesh position={[0.0004, -0.0066, 0]}>
        <planeGeometry args={[0.0026, 0.004]} />
        <Glow />
      </mesh>
      <mesh position={[0.0004, -0.0115, 0]}>
        <circleGeometry args={[0.0014, 16]} />
        <Glow />
      </mesh>
    </group>
  )
}

/** three.js's classic heart outline, centred, about 22 × 19 units, point up (flipped where used). */
function heartShape() {
  const s = new THREE.Shape()
  s.moveTo(0, -4.5)
  s.bezierCurveTo(0, -4.5, -1, -9.5, -5, -9.5)
  s.bezierCurveTo(-11, -9.5, -11, -2.5, -11, -2.5)
  s.bezierCurveTo(-11, 1.5, -8, 5.9, 0, 9.5)
  s.bezierCurveTo(7, 5.9, 11, 1.5, 11, -2.5)
  s.bezierCurveTo(11, -2.5, 11, -9.5, 5, -9.5)
  s.bezierCurveTo(2, -9.5, 0, -4.5, 0, -4.5)
  return s
}

/** A bold "Z" in a 1 × 1 box, centred. */
function zShape() {
  const points: [number, number][] = [
    [0, 1], [1, 1], [1, 0.8], [0.3, 0.2], [1, 0.2], [1, 0], [0, 0], [0, 0.2], [0.7, 0.8], [0, 0.8],
  ]
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x - 0.5, y - 0.5)))
}

/** 0 → 1 with a small overshoot, for a springy pop. */
function easeOutBack(t: number) {
  const c1 = 1.70158
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function roundedRect(width: number, height: number, radius: number) {
  const x = -width / 2
  const y = -height / 2
  const shape = new THREE.Shape()
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return shape
}

/** A WebGL or model-loading failure shows the flat face instead of breaking the chat. */
class RobotBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[AssistantRobot] 3D robot unavailable, showing the flat face:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(REDUCED_MOTION)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => matchMedia(REDUCED_MOTION).matches,
  )
}
