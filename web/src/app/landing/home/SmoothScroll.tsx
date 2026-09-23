import 'lenis/dist/lenis.css'

import Lenis from 'lenis'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { gsap, ScrollTrigger } from '@/app/landing/home/gsap'
import { setLenis } from '@/app/landing/home/lenis'

/**
 * Lenis smooth scrolling, scoped to the home page.
 *
 * The rest of the app keeps native scrolling on purpose: the itinerary editor
 * uses dnd-kit drag-and-drop and several pages rely on sticky positioning, both
 * of which smooth-scroll libraries tend to break.
 *
 * Lenis is driven by GSAP's ticker so that it and ScrollTrigger advance on the
 * same frame; otherwise pinned sections visibly lag the scroll by one frame.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
      autoRaf: false,
    })

    setLenis(lenis)
    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      setLenis(null)
    }
  }, [])

  return <>{children}</>
}
