/**
 * GSAP entry point for the home page.
 *
 * Plugins are registered once here; every home module imports gsap from this
 * file rather than from 'gsap' directly so registration is guaranteed to have
 * happened first.
 */

import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

// Mobile browsers resize the viewport as the URL bar shows/hides; refreshing
// every pin on that would make the page jump mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true })

/** The three branches every stage builds for, via gsap.matchMedia(). */
export const MEDIA = {
  desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
} as const

export type MediaConditions = { desktop: boolean; mobile: boolean; reduce: boolean }

export { gsap, ScrollTrigger, SplitText, useGSAP }
