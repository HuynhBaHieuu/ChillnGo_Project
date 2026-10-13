/**
 * Smooth 1-D noise in [-1, 1]: wanders without repeating, unlike a sine wave.
 * Two octaves, so the slow drift carries a little fine detail.
 */
export function noise(t: number, seed: number): number {
  return 0.7 * octave(t, seed) + 0.3 * octave(t * 2.3, seed + 17.3)
}

function octave(t: number, seed: number): number {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * f * (f * (f * 6 - 15) + 10) // smootherstep: no visible kinks
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u
}

function hash(i: number, seed: number): number {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}
