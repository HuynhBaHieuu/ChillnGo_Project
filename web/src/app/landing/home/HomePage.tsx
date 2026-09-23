import { useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect } from 'react'

import { MEDIA, ScrollTrigger, gsap, useGSAP } from '@/app/landing/home/gsap'
import { clearNavTheme, setNavTheme } from '@/app/landing/home/navTheme'
import type { NavTheme } from '@/app/landing/home/navTheme'
import { SmoothScroll } from '@/app/landing/home/SmoothScroll'
import { DestinationsStage } from '@/app/landing/home/stages/DestinationsStage'
import { FeaturedTripsStage } from '@/app/landing/home/stages/FeaturedTripsStage'
import { HomeFooter } from '@/app/landing/home/stages/HomeFooter'
import { HowItWorksStage } from '@/app/landing/home/stages/HowItWorksStage'
import { IntroStage } from '@/app/landing/home/stages/IntroStage'
import { StatsStage } from '@/app/landing/home/stages/StatsStage'
import { qk } from '@/lib/queryKeys'
import { discoveryService, landingService } from '@/services'
import { useViewerId } from '@/store'

const MOMENT_PHOTOS = 14

/**
 * The home page: six scroll-driven stages on a Lenis-smoothed page.
 *
 * The hero needs no data, so it renders immediately. Every stage below it waits
 * for its data before mounting: pinned sections measure their own content when
 * their ScrollTrigger is created, and measuring a loading placeholder would put
 * every pin after it in the wrong place.
 */
export function HomePage() {
  const viewerId = useViewerId()

  const stats = useQuery({
    queryKey: qk.landing.stats,
    queryFn: () => landingService.getLandingStats(),
  })
  const rows = useQuery({
    queryKey: qk.landing.destinations,
    queryFn: () => landingService.getDestinationRows(),
  })
  const photos = useQuery({
    queryKey: qk.landing.moments(MOMENT_PHOTOS),
    queryFn: () => landingService.getMomentPhotos(MOMENT_PHOTOS),
  })
  const featured = useQuery({
    queryKey: qk.discover.list(discoveryService.DEFAULT_FILTERS, viewerId),
    queryFn: () => discoveryService.discoverPosts(discoveryService.DEFAULT_FILTERS, viewerId),
  })

  const ready = Boolean(stats.data && rows.data && photos.data && featured.data)

  // The page opens on dark footage; hand the nav back to its default on leave.
  useLayoutEffect(() => {
    setNavTheme('dark')
    return () => clearNavTheme()
  }, [])

  // Web fonts change text heights, which moves every pin below the hero.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh()
    })
    return () => {
      cancelled = true
    }
  }, [ready])

  /*
   * Re-assert the hero's theme once the stages below have been measured.
   *
   * Each stage announces its theme from `onUpdate`, and ScrollTrigger also
   * fires `onUpdate` while it measures — for stages far off-screen too. The
   * stages only mount once their data arrives, so the last one measured (the
   * footer, on paper) wins, and the navbar can sit over the dark hero wearing
   * the light theme until the first scroll moves it.
   */
  useEffect(() => {
    if (!ready) return
    const settle = () => {
      if (window.scrollY < 4) setNavTheme('dark')
    }
    settle()
    ScrollTrigger.addEventListener('refresh', settle)
    return () => ScrollTrigger.removeEventListener('refresh', settle)
  }, [ready])

  // With reduced motion there are no stage timelines to drive the nav theme,
  // so each section sets it plainly as it passes under the navbar.
  useGSAP(
    () => {
      if (!ready) return
      const mm = gsap.matchMedia()
      mm.add(MEDIA.reduce, () => {
        document.querySelectorAll<HTMLElement>('[data-reduce-theme]').forEach((section) => {
          ScrollTrigger.create({
            trigger: section,
            start: 'top 44px',
            end: 'bottom 44px',
            onToggle: (self) => {
              if (self.isActive) setNavTheme(section.dataset.reduceTheme as NavTheme)
            },
          })
        })
      })
    },
    { dependencies: [ready] },
  )

  return (
    <SmoothScroll>
      <div className="bg-background text-foreground">
        <IntroStage />

        {ready && stats.data && rows.data && photos.data && featured.data ? (
          <>
            <StatsStage stats={stats.data} />
            <HowItWorksStage />
            <DestinationsStage rows={rows.data} photos={photos.data} />
            <FeaturedTripsStage posts={featured.data} />
            <HomeFooter />
          </>
        ) : (
          <div aria-hidden className="h-screen" />
        )}
      </div>
    </SmoothScroll>
  )
}
