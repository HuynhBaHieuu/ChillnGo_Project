import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'

/**
 * The curved WebGL photo gallery the destinations stage opens into — adapted
 * from the CircularGallery pattern (OGL).
 *
 * Photos sit in a row that bends down an arc at both ends, and ripple while
 * the row moves. The row is not scrolled by the wheel or by dragging, as the
 * original was: the stage's pinned timeline owns the page scroll, so it calls
 * `scrollTo()` and this only eases toward that position.
 *
 * It renders only between `play()` and `pause()`, so the GPU is idle for the
 * rest of the page.
 */

type GL = Renderer['gl']

export interface GalleryItem {
  image: string
  text: string
}

export interface CurvedGalleryOptions {
  items: GalleryItem[]
  /** How far the row bends at its ends, in world units. 0 = flat. */
  bend?: number
  textColor?: string
  /** One font family name (see `displayFontFamily`). */
  fontFamily?: string
  /** Corner radius as a fraction of the card, 0–0.5. */
  borderRadius?: number
  /** Per-frame catch-up toward the scroll target, 0–1. */
  ease?: number
}

/** Label height in CSS px, drawn at 2× so it stays sharp on retina screens. */
const LABEL_PX = 18
const LABEL_OVERSAMPLE = 2
/** Space between a card and its label, in CSS px. */
const LABEL_GAP = 14

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** One texture per photo URL: the row repeats every photo twice. */
interface Photo {
  texture: Texture
  /** Natural size, filled in place once the image loads. */
  size: [number, number]
  /** Uniform value, 1 once loaded; until then the card shows a flat surface. */
  ready: { value: number }
}

function loadPhoto(gl: GL, url: string): Photo {
  const texture = new Texture(gl, { generateMipmaps: true })
  const photo: Photo = { texture, size: [1, 1], ready: { value: 0 } }
  const img = new Image()
  // Required for WebGL to sample it; a host without CORS just leaves the
  // surface colour.
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.onload = () => {
    texture.image = img
    photo.size[0] = img.naturalWidth
    photo.size[1] = img.naturalHeight
    photo.ready.value = 1
  }
  img.src = url
  return photo
}

function labelTexture(gl: GL, text: string, font: string, color: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const pad = 8 * LABEL_OVERSAMPLE
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2
  canvas.height = Math.ceil(LABEL_PX * LABEL_OVERSAMPLE * 1.3) + pad * 2
  // Resizing a canvas resets its context state.
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new Texture(gl, { image: canvas, generateMipmaps: false })
  return { texture, width: canvas.width, height: canvas.height }
}

const CARD_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // A slow ripple at rest that swells with scroll speed.
    p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const CARD_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec2 uImageSizes;
  uniform vec2 uPlaneSizes;
  uniform sampler2D tMap;
  uniform float uBorderRadius;
  uniform float uReady;
  uniform vec3 uSurface;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
  }

  void main() {
    // object-fit: cover
    vec2 ratio = vec2(
      min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
      min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
    );
    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
    vec3 color = mix(uSurface, texture2D(tMap, uv).rgb, uReady);

    float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
    float alpha = 1.0 - smoothstep(-0.002, 0.002, d);
    gl_FragColor = vec4(color, alpha);
  }
`

const LABEL_VERTEX = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const LABEL_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(tMap, vUv);
    if (color.a < 0.1) discard;
    gl_FragColor = color;
  }
`

interface Size {
  width: number
  height: number
}

class Card {
  plane: Mesh
  label: Mesh
  labelPx: Size
  index: number
  count: number
  bend: number
  /** Resting x in the row, and the wrap-around offset added as it loops. */
  x = 0
  extra = 0
  width = 0
  widthTotal = 0
  viewport: Size = { width: 0, height: 0 }

  constructor(
    gl: GL,
    geometry: Plane,
    labelGeometry: Plane,
    scene: Transform,
    photo: Photo,
    label: ReturnType<typeof labelTexture>,
    opts: { index: number; count: number; bend: number; borderRadius: number; surface: number[] },
  ) {
    this.index = opts.index
    this.count = opts.count
    this.bend = opts.bend

    const program = new Program(gl, {
      vertex: CARD_VERTEX,
      fragment: CARD_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        tMap: { value: photo.texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: photo.size },
        uReady: photo.ready,
        uSurface: { value: opts.surface },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: opts.borderRadius },
      },
    })
    this.plane = new Mesh(gl, { geometry, program })
    this.plane.setParent(scene)

    this.labelPx = { width: label.width / LABEL_OVERSAMPLE, height: label.height / LABEL_OVERSAMPLE }
    this.label = new Mesh(gl, {
      geometry: labelGeometry,
      program: new Program(gl, {
        vertex: LABEL_VERTEX,
        fragment: LABEL_FRAGMENT,
        depthTest: false,
        transparent: true,
        uniforms: { tMap: { value: label.texture } },
      }),
    })
    // A child of the card, so it follows the bend and tilt.
    this.label.setParent(this.plane)
  }

  resize(screen: Size, viewport: Size) {
    this.viewport = viewport
    // Cards are 7:9 and 60% of the gallery's height, as in the original.
    const scale = screen.height / 1500
    this.plane.scale.y = (viewport.height * (900 * scale)) / screen.height
    this.plane.scale.x = (viewport.width * (700 * scale)) / screen.width
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y]

    this.width = this.plane.scale.x + 2
    this.widthTotal = this.width * this.count
    this.x = this.width * this.index

    // The label is sized in CSS px, then divided by the card's scale because
    // it inherits it.
    const pxToWorld = viewport.height / screen.height
    const w = this.labelPx.width * pxToWorld
    const h = this.labelPx.height * pxToWorld
    this.label.scale.set(w / this.plane.scale.x, h / this.plane.scale.y, 1)
    this.label.position.y = -0.5 - (h / 2 + LABEL_GAP * pxToWorld) / this.plane.scale.y
  }

  update(scroll: { current: number; last: number }, direction: 'right' | 'left') {
    this.plane.position.x = this.x - scroll.current - this.extra
    const x = this.plane.position.x
    const H = this.viewport.width / 2

    if (this.bend === 0) {
      this.plane.position.y = 0
      this.plane.rotation.z = 0
    } else {
      // Ride a circle through the screen's edges that dips `bend` at them.
      const B = Math.abs(this.bend)
      const R = (H * H + B * B) / (2 * B)
      const ex = Math.min(Math.abs(x), H)
      const arc = R - Math.sqrt(R * R - ex * ex)
      const sign = this.bend > 0 ? 1 : -1
      this.plane.position.y = -arc * sign
      this.plane.rotation.z = -sign * Math.sign(x) * Math.asin(ex / R)
    }

    const uniforms = this.plane.program.uniforms
    uniforms.uTime.value += 0.04
    uniforms.uSpeed.value = scroll.current - scroll.last

    // Loop: a card that leaves one side re-enters from the other.
    const half = this.plane.scale.x / 2
    if (direction === 'right' && x + half < -H) this.extra -= this.widthTotal
    if (direction === 'left' && x - half > H) this.extra += this.widthTotal
  }
}

export class CurvedGallery {
  private container: HTMLElement
  private opts: Required<CurvedGalleryOptions>
  private renderer: Renderer
  private gl: GL
  private camera: Camera
  private scene = new Transform()
  private geometry: Plane
  private labelGeometry: Plane
  private cards: Card[] = []
  private screen: Size = { width: 0, height: 0 }
  private viewport: Size = { width: 0, height: 0 }
  private scroll = { current: 0, last: 0 }
  /** Where the timeline wants the row, in card widths. */
  private target = 0
  private raf = 0
  private destroyed = false

  constructor(container: HTMLElement, options: CurvedGalleryOptions) {
    this.container = container
    this.opts = {
      bend: 3,
      textColor: '#ffffff',
      fontFamily: 'sans-serif',
      borderRadius: 0.05,
      ease: 0.1,
      ...options,
    }

    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    })
    this.gl = this.renderer.gl
    this.gl.clearColor(0, 0, 0, 0)
    const canvas = this.gl.canvas as HTMLCanvasElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.display = 'block'
    container.appendChild(canvas)

    this.camera = new Camera(this.gl, { fov: 45 })
    this.camera.position.z = 20
    this.geometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 })
    this.labelGeometry = new Plane(this.gl)

    this.resize()
    window.addEventListener('resize', this.resize)

    // Labels are drawn once onto a canvas, so the face has to be loaded first.
    const font = this.font()
    void document.fonts
      .load(font)
      .catch(() => undefined)
      .then(() => {
        if (!this.destroyed) this.createCards(font)
      })
  }

  private font() {
    return `600 ${LABEL_PX * LABEL_OVERSAMPLE}px "${this.opts.fontFamily.replace(/["']/g, '')}", sans-serif`
  }

  private createCards(font: string) {
    const { items, bend, borderRadius, textColor } = this.opts
    if (!items.length) return

    // The surface a card shows until its photo arrives: faint ink.
    const surface = [0.14, 0.14, 0.14]
    const photos = new Map<string, Photo>()
    const labels = new Map<string, ReturnType<typeof labelTexture>>()
    const row = items.concat(items)

    this.cards = row.map((item, index) => {
      if (!photos.has(item.image)) photos.set(item.image, loadPhoto(this.gl, item.image))
      if (!labels.has(item.text)) labels.set(item.text, labelTexture(this.gl, item.text, font, textColor))
      return new Card(this.gl, this.geometry, this.labelGeometry, this.scene, photos.get(item.image)!, labels.get(item.text)!, {
        index,
        count: row.length,
        bend,
        borderRadius,
        surface,
      })
    })
    this.cards.forEach((card) => card.resize(this.screen, this.viewport))
    this.scroll.current = this.scroll.last = this.targetWorld()
  }

  private targetWorld() {
    return this.target * (this.cards[0]?.width ?? 0)
  }

  private resize = () => {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight }
    if (!this.screen.width || !this.screen.height) return
    this.renderer.setSize(this.screen.width, this.screen.height)
    this.camera.perspective({ aspect: this.screen.width / this.screen.height })
    const fov = (this.camera.fov * Math.PI) / 180
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z
    this.viewport = { width: height * this.camera.aspect, height }
    this.cards.forEach((card) => card.resize(this.screen, this.viewport))
  }

  private tick = () => {
    this.scroll.current = lerp(this.scroll.current, this.targetWorld(), this.opts.ease)
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left'
    this.cards.forEach((card) => card.update(this.scroll, direction))
    this.renderer.render({ scene: this.scene, camera: this.camera })
    this.scroll.last = this.scroll.current
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Move the row so that `cards` card widths have passed the centre. */
  scrollTo(cards: number) {
    this.target = cards
  }

  play() {
    if (this.raf || this.destroyed) return
    // Resume where the timeline is, not with a sweep from wherever it paused.
    this.scroll.current = this.scroll.last = this.targetWorld()
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  destroy() {
    this.destroyed = true
    this.pause()
    window.removeEventListener('resize', this.resize)
    ;(this.gl.canvas as HTMLCanvasElement).remove()
    // Browsers cap live WebGL contexts; don't wait for GC to free this one.
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
