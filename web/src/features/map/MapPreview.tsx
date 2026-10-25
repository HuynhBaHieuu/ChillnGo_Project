import { Suspense, lazy, useMemo } from 'react'

import { MAPBOX_TOKEN, boundsOf, routeCoordinates, stopsOfDays } from '@/features/map/geometry'
import type { MapPin } from '@/features/map/geometry'
import { StaticRouteFallback } from '@/features/map/StaticRouteFallback'
import { t } from '@/i18n'
import type { RouteGeoJson, TripDay } from '@/services/types'

export type { MapPin }

/** Mapbox (~700 kB) is only fetched once a map is actually about to render. */
const MapboxMap = lazy(() => import('@/features/map/MapboxMap'))

interface MapPreviewProps {
  /** A route to draw as a line. Comes straight from `TripPost.routeGeoJson`. */
  route?: RouteGeoJson
  /** Individual points to mark. Rendered clustered when `cluster` is set. */
  pins?: MapPin[]
  cluster?: boolean
  /**
   * A trip's days. Every stop is marked, coloured by day, and a day's route is
   * only drawn once the reader picks that day: with many stops, every route at
   * once is a tangle. Use instead of `route`.
   */
  days?: TripDay[]
  className?: string
  /** Accessible description of what the map is showing. */
  label?: string
}

/**
 * The app's map surface — used by the post detail route view, the itinerary
 * detail view, and Discover's map view (with `cluster`).
 *
 * Without `VITE_MAPBOX_TOKEN`, or with no coordinates to show, it renders a
 * static sketch of the route rather than a broken grey box.
 */
export function MapPreview({
  route,
  pins = [],
  cluster = false,
  days,
  className,
  label = t('Bản đồ hành trình'),
}: MapPreviewProps) {
  const stops = useMemo(() => (days ? stopsOfDays(days) : []), [days])
  const allCoords = useMemo<[number, number][]>(
    () => [
      ...routeCoordinates(route),
      ...pins.map((p): [number, number] => [p.lng, p.lat]),
      ...stops.map((s): [number, number] => [s.lng, s.lat]),
    ],
    [route, pins, stops],
  )
  // Stops alone are not a route, so the sketch does not join them up.
  const connect = !days

  const canRenderMap = Boolean(MAPBOX_TOKEN) && boundsOf(allCoords) !== null

  if (!canRenderMap) {
    return <StaticRouteFallback coords={allCoords} connect={connect} className={className} label={label} />
  }

  return (
    <Suspense
      fallback={
        <StaticRouteFallback
          coords={allCoords}
          connect={connect}
          className={className}
          label={label}
          reason="loading"
        />
      }
    >
      <MapboxMap
        route={route}
        pins={pins}
        stops={stops}
        cluster={cluster}
        className={className}
        label={label}
      />
    </Suspense>
  )
}
