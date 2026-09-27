import { useEffect, useRef } from 'react'
import type { TubesApp } from 'threejs-components/build/cursors/tubes1.min.js'

import { cn } from '@/lib/utils'

/*
 * Neon tubes that chase the cursor (threejs-components, tubes1). The build
 * bundles its own three.js — about 800 KB — so it is imported on mount, never
 * in the main chunk. It pauses itself while the canvas is off screen.
 */

const TUBE_COLORS = ['#FF3DA5', '#8A7CA8', '#00FFFF']
const LIGHT_COLORS = ['#FF3DA5', '#1A0B3C', '#00FFFF', '#FFFFFF']

const randomColor = () =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`

interface TubesBackgroundProps {
  className?: string
}

/**
 * The hero's interactive backdrop. Sits on the deep purple ink, because the
 * tubes are additive light and vanish on the pink ground. Clicking anywhere in
 * the enclosing section re-rolls one of the lights.
 *
 * Callers render it only when motion is allowed; if WebGL is unavailable the
 * canvas stays empty and the purple shows through.
 */
export function TubesBackground({ className }: TubesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let app: TubesApp | undefined
    let cancelled = false

    const onClick = () =>
      app?.tubes.setLightsColors([randomColor(), '#FF3DA5', '#00FFFF', '#1A0B3C'])
    // The hero copy sits above the canvas, so listen on the whole section.
    const host = canvas.closest('section') ?? canvas.parentElement
    host?.addEventListener('click', onClick)

    import('threejs-components/build/cursors/tubes1.min.js')
      .then(({ default: TubesCursor }) => {
        if (cancelled) return
        app = TubesCursor(canvas, {
          tubes: {
            colors: TUBE_COLORS,
            lights: { intensity: 150, colors: LIGHT_COLORS },
          },
        })
      })
      .catch((error: unknown) => {
        console.warn('[TubesBackground] could not start, keeping the flat ground', error)
      })

    return () => {
      cancelled = true
      host?.removeEventListener('click', onClick)
      app?.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // The bloom pass renders an opaque black ground; `screen` drops the black
      // and adds only the light onto whatever purple sits behind the canvas.
      className={cn('pointer-events-none absolute inset-0 size-full mix-blend-screen', className)}
    />
  )
}
