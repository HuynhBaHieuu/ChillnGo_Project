/** Clip shapes for the dome transition (see Dome.tsx). */
export const DOME_FROM = 'ellipse(60% 0% at 50% 100%)'
export const DOME_TO = 'ellipse(150% 130% at 50% 100%)'

/** Add the dome rise to a scrubbed timeline. */
export function addDome(
  tl: GSAPTimeline,
  dome: Element | null,
  position: number,
  duration: number,
) {
  tl.fromTo(
    dome,
    { clipPath: DOME_FROM },
    { clipPath: DOME_TO, ease: 'power2.in', duration },
    position,
  )
}
