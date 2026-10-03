/**
 * Still pictures from a replay video, drawn in the browser. Needs the
 * recordings bucket's CORS rule (server/README.md): without it the canvas is
 * "tainted" and reading it throws a SecurityError.
 */

/** Resolves on the video's next `event`; rejects if the video fails first. */
export function once(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
      reject(new Error('media'))
    }
    video.addEventListener(event, done)
    video.addEventListener('error', fail)
  })
}

/** Draws the video's current frame on `canvas`, at most `maxWidth` wide. A tainted canvas throws only when read. */
export function snapshot(video: HTMLVideoElement, canvas: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / video.videoWidth)
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Recordings open on black: LiveKit starts writing before the camera's first
 * picture arrives (1–3 s in practice). These are the moments tried, in order,
 * for the first real picture.
 */
const PROBE_TIMES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15]

/** Average brightness (0–255) under which a frame counts as black. */
const DARK = 12

function isDark(video: HTMLVideoElement, probe: HTMLCanvasElement): boolean {
  const data = snapshot(video, probe, 32).getContext('2d')?.getImageData(0, 0, probe.width, probe.height).data
  if (!data) return false
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2]
  return sum / ((data.length / 4) * 3) < DARK
}

async function findOpeningFrame(url: string): Promise<string | null> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await once(video, 'loadedmetadata')
    const end = Number.isFinite(video.duration) ? video.duration : 0
    const times = PROBE_TIMES.filter((t) => t < end - 0.1)
    if (times.length === 0) times.push(end / 2)
    const probe = document.createElement('canvas')
    for (const t of times) {
      video.currentTime = t
      await once(video, 'seeked')
      // A stream that stayed black throughout: its last probed frame is as good as any.
      if (!isDark(video, probe) || t === times[times.length - 1]) {
        return snapshot(video, document.createElement('canvas'), 640).toDataURL('image/jpeg', 0.8)
      }
    }
    return null
  } catch {
    // Unreadable video, or no CORS on the bucket (SecurityError): no picture.
    return null
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

/** One search per recording per page load, whichever card or player asks first. */
const found = new Map<string, Promise<string | null>>()

/**
 * The replay's opening picture (its first frame that is not black) as an
 * image address, or null when it cannot be read. Signed links change on every
 * fetch, so results are kept per file, not per link.
 */
export function openingFrame(url: string): Promise<string | null> {
  const file = url.split('?')[0]
  let pending = found.get(file)
  if (!pending) {
    pending = findOpeningFrame(url)
    found.set(file, pending)
  }
  return pending
}
