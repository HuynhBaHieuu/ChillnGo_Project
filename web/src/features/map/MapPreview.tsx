import { Suspense, lazy, useMemo } from 'react'

import { MAPBOX_TOKEN, boundsOf, routeCoordinates } from '@/features/map/geometry'
import type { MapPin } from '@/features/map/geometry'
import { StaticRouteFallback } from '@/features/map/StaticRouteFallback'
import type { RouteGeoJson } from '@/services/types'

export type { MapPin }

/** Mapbox (~700 kB) is only fetched once a map is actually about to render. */
const MapboxMap = lazy(() => import('@/features/map/MapboxMap'))

interface MapPreviewProps {
  /** A route to draw as a line. Comes straight from `TripPost.routeGeoJson`. */
  route?: RouteGeoJson
  /** Individual points to mark. Rendered clustered when `cluster` is set. */
  pins?: MapPin[]
  cluster?: boolean
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
  className,
  label = 'Bản đồ hành trình',
}: MapPreviewProps) {
  const allCoords = useMemo<[number, number][]>(
    () => [
      ...routeCoordinates(route),
      ...pins.map((p): [number, number] => [p.lng, p.lat]),
    ],
    [route, pins],
  )

  const canRenderMap = Boolean(MAPBOX_TOKEN) && boundsOf(allCoords) !== null

  if (!canRenderMap) {
    return <StaticRouteFallback coords={allCoords} className={className} label={label} />
  }

  return (
    <Suspense
      fallback={
        <StaticRouteFallback
          coords={allCoords}
          className={className}
          label={label}
          reason="loading"
        />
      }
    >
      <MapboxMap
        route={route}
        pins={pins}
        cluster={cluster}
        className={className}
        label={label}
      />
    </Suspense>
  )
}
