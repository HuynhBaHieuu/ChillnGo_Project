import type Lenis from 'lenis'

/** The running Lenis instance, while the home page is mounted. */
let instance: Lenis | null = null

export function setLenis(lenis: Lenis | null) {
  instance = lenis
}

/** Scroll to the top through Lenis when it is running, natively otherwise. */
export function scrollToTop() {
  if (instance) instance.scrollTo(0)
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}
