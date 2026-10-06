/**
 * Timing constants for the home page scroll experience.
 *
 * Only two stages pin (the intro and the destinations); everything else scrolls
 * in flow. Pinned timelines are authored in **units**, where 1 unit = 100vh of
 * scroll.
 */

/** Catch-up smoothing for scrubbed timelines. Kept low because Lenis already smooths. */
export const SCRUB = 0.6

/** Pins run shorter on phones, where each swipe covers more of the viewport. */
export const MOBILE_PIN_FACTOR = 0.7

export const UNITS = {
  /** Hero leaves, the statement photo grows to full screen, the statement reads, both leave. */
  intro: 2.6,
  /** Compass opens into the gallery, five photos pass, the gallery leaves. */
  destinationTail: 2.6,
} as const

/** Pin length in pixels for a timeline of `units`, evaluated at refresh time. */
export function pinLength(units: number): () => string {
  return () => `+=${units * window.innerHeight}`
}

export const vh = (n: number) => () => (n / 100) * window.innerHeight
export const vw = (n: number) => () => (n / 100) * window.innerWidth
