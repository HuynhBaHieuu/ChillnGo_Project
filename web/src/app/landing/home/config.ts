/**
 * Timing constants for the home page scroll experience.
 *
 * Pinned timelines are authored in **units**, where 1 unit = 100vh of scroll.
 * The unit lengths below were derived from the reference recording at
 * VH_PER_SECOND vh of scroll per second of footage; change that ratio and every
 * pin stretches or shrinks together.
 */

export const VH_PER_SECOND = 50

/** Catch-up smoothing for scrubbed timelines. Kept low because Lenis already smooths. */
export const SCRUB = 0.6

/** Pins run shorter on phones, where each swipe covers more of the viewport. */
export const MOBILE_PIN_FACTOR = 0.7

export const UNITS = {
  /** Hero parallax, then the statement. 4.0 after the two were overlapped. */
  intro: 4.0,
  stats: 1.5,
  /** How-it-works: 0.4 units per item plus 0.4 for entry and exit. */
  howItWorks: (items: number) => items * 0.4 + 0.4,
  /** Destinations list travel: 0.033 units per row, never under 1.2. */
  destinationList: (rows: number) => Math.max(1.2, rows * 0.033),
  /** Circle reveal + photo wheel + dome, after the list. */
  destinationTail: 3.5,
} as const

/** Pin length in pixels for a timeline of `units`, evaluated at refresh time. */
export function pinLength(units: number): () => string {
  return () => `+=${units * window.innerHeight}`
}

export const vh = (n: number) => () => (n / 100) * window.innerHeight
export const vw = (n: number) => () => (n / 100) * window.innerWidth
