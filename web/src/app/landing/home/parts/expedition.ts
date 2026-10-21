import { SCRUB } from '@/app/landing/home/config'
import { gsap } from '@/app/landing/home/gsap'

/** Draw every scribble in `scope` on as it scrolls into view. */
export function drawScribbles(scope: Element) {
  scope.querySelectorAll('.xp-scribble path').forEach((path) => {
    gsap.fromTo(
      path,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: path, start: 'top 90%', end: 'top 55%', scrub: SCRUB } },
    )
  })
}
