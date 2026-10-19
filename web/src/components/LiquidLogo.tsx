import { useEffect, useRef, useState } from 'react'

import BEVEL from '@/assets/images/chillngo-liquid-bevel.png'
import { liquidFragSource } from '@/components/liquidLogoFrag'
import { cn } from '@/lib/utils'

/**
 * Look tuned by hand in the liquid-logo app (D:\Documents\FPT\WDP301\liquid-logo):
 * lavender chrome, near-black shadow. To change it, re-tune there, run
 * `node scripts/export-loop.mjs "<url>" <name>`, and copy `export/<name>-bevel.png`
 * over the texture above if the logo shape changed.
 */
const PARAMS = {
  u_refraction: 0.006,
  u_edge: 0.06,
  u_patternBlur: 0.007,
  u_liquid: 0.17,
  u_patternScale: 2,
}
const SPEED = 0.3
const HIGHLIGHT = [0xdc, 0xd0, 0xf0].map((c) => c / 255)
const SHADOW = [0x1f, 0x1f, 0x23].map((c) => c / 255)
/** The bevel texture (compass + wordmark, "T1 · La bàn") is 1000×299. */
const IMG_RATIO = 1000 / 299

const VERTEX_SOURCE = `#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 vUv;
void main() {
  vUv = .5 * (a_position + 1.);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

/**
 * The ChillnGo wordmark in animated liquid metal, drawn live on a transparent
 * canvas so it works on the glass bar and over every home section (a video
 * would need alpha, which Safari cannot play from WebM).
 *
 * The texture is the bevel the app pre-computes from the logo, so the page skips
 * that ~1s step. The shader lights a square and the wordmark is its middle band,
 * so the canvas stays square and the wrapper crops it, exactly as in the app.
 */
export function LiquidLogo({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl2', { antialias: true, alpha: true })
    const program = gl && createProgram(gl)
    if (!canvas || !gl || !program) {
      setFailed(true)
      return
    }

    gl.useProgram(program)
    const uniform = (name: string) => gl.getUniformLocation(program, name)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    for (const [name, value] of Object.entries(PARAMS)) gl.uniform1f(uniform(name), value)
    gl.uniform1f(uniform('u_ratio'), 1)
    gl.uniform1f(uniform('u_img_ratio'), IMG_RATIO)
    gl.uniform3fv(uniform('u_highlight'), HIGHLIGHT)
    gl.uniform3fv(uniform('u_shadow'), SHADOW)

    // At least 2x: on 1x screens the thin chrome highlights alias without it.
    const side = Math.round(canvas.clientWidth * Math.max(window.devicePixelRatio, 2))
    canvas.width = side
    canvas.height = side
    gl.viewport(0, 0, side, side)

    // Reduced motion: one still frame instead of the loop.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeUniform = uniform('u_time')
    let frame = 0
    let time = 0
    let last = performance.now()
    function draw(now: number) {
      time += (now - last) * SPEED
      last = now
      gl!.uniform1f(timeUniform, still ? 300 : time)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      if (!still) frame = requestAnimationFrame(draw)
    }

    const image = new Image()
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.uniform1i(uniform('u_image_texture'), 0)
      last = performance.now()
      draw(last)
    }
    image.onerror = () => setFailed(true)
    image.src = BEVEL

    return () => {
      image.onload = null
      cancelAnimationFrame(frame)
    }
  }, [])

  if (failed) {
    return (
      <span aria-hidden className={cn('font-display text-3xl leading-none tracking-tight', className)}>
        ChillnGo
      </span>
    )
  }

  return (
    <span aria-hidden className={cn('relative block overflow-hidden', className)} style={{ aspectRatio: IMG_RATIO }}>
      <canvas ref={canvasRef} className="absolute left-0 top-1/2 aspect-square w-full -translate-y-1/2" />
    </span>
  )
}

function createProgram(gl: WebGL2RenderingContext) {
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SOURCE],
    [gl.FRAGMENT_SHADER, liquidFragSource],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('LiquidLogo shader:', gl.getShaderInfoLog(shader))
      return null
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}
