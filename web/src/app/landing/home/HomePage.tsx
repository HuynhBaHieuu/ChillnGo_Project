import { useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect } from 'react'

import { ScrollTrigger } from '@/app/landing/home/gsap'
import { clearNavTheme, setNavTheme } from '@/app/landing/home/navTheme'
import { SmoothScroll } from '@/app/landing/home/SmoothScroll'
import { GridOverlay } from '@/app/landing/home/parts/ExpeditionMarks'
import { FeaturedTripsStage } from '@/app/landing/home/stages/FeaturedTripsStage'
import { HomeFooter } from '@/app/landing/home/stages/HomeFooter'
import { HowItWorksStage } from '@/app/landing/home/stages/HowItWorksStage'
import { HeroStage } from '@/app/landing/home/stages/HeroStage'
import { RouteScrollStage } from '@/app/landing/home/stages/RouteScrollStage'
import { StatementStage } from '@/app/landing/home/stages/StatementStage'
import { TripsFlickStage } from '@/app/landing/home/stages/TripsFlickStage'
import { qk } from '@/lib/queryKeys'
import { discoveryService, landingService } from '@/services'
import { useViewerId } from '@/store'

/**
 * The home page: scroll-driven stages on a Lenis-smoothed page. It opens with
 * the expedition stages (hero → statement → trips → route, on the dark ground
 * under hairline column guides), then the dark stages. Only the route pins.
 *
 * The hero needs no data, so it renders immediately. Every stage below it waits
 * for its data before mounting: the destinations pin measures its own content
 * when its ScrollTrigger is created, and measuring a loading placeholder would
 * put it in the wrong place.
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
  const featured = useQuery({
    queryKey: qk.discover.list(discoveryService.DEFAULT_FILTERS, viewerId),
    queryFn: () => discoveryService.discoverPosts(discoveryService.DEFAULT_FILTERS, viewerId),
  })

  const ready = Boolean(stats.data && rows.data && featured.data)

  // Every stage sits on the dark ground; hand the nav back to its default on leave.
  useLayoutEffect(() => {
    setNavTheme('dark')
    return () => clearNavTheme()
  }, [])

  /*
   * Web fonts change text heights, which moves every trigger below the hero.
   *
   * A background refetch can also change how many stops or cards a stage has
   * (cached data renders first). That stage then rebuilds its triggers after
   * the stages below it were created, so put the triggers back in page order
   * before re-measuring.
   */
  const rowCount = rows.data?.length
  const cardCount = featured.data?.length
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      ScrollTrigger.sort()
      ScrollTrigger.refresh()
    })
    return () => {
      cancelled = true
    }
  }, [ready, rowCount, cardCount])

  return (
    <SmoothScroll>
      <div aria-hidden className="home-grain" />
      {/* overflow-x-clip: stages that slide sideways can overhang the viewport by a
          sub-pixel, enough for a horizontal scrollbar. `clip`, unlike `hidden`, does
          not create a scroll container, so sticky and pinned elements keep working. */}
      <div className="overflow-x-clip bg-background text-foreground">
        <div className="xp relative">
          <HeroStage />
          {ready && stats.data && rows.data && featured.data && (
            <>
              <StatementStage stats={stats.data} />
              <TripsFlickStage posts={featured.data} />
              <RouteScrollStage rows={rows.data} stats={stats.data} />
            </>
          )}
          <GridOverlay />
        </div>

        {ready && stats.data && rows.data && featured.data ? (
          <>
            <HowItWorksStage />
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
