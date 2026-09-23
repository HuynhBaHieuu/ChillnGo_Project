import { optionalEnv } from '@/lib/env'
import type { RouteGeoJson } from '@/services/types'

export interface MapPin {
  id: string
  lng: number
  lat: number
  label: string
  /** Extra data carried through to the clustered source (e.g. bookmark count). */
  weight?: number
}

export type Bounds = [[number, number], [number, number]]

/** Flatten every coordinate a route touches, in itinerary order. */
export function routeCoordinates(route?: RouteGeoJson): [number, number][] {
  return route?.features.flatMap((f) => f.geometry.coordinates) ?? []
}

/** Bounding box with a small pad, so a single point still fits. */
export function boundsOf(coords: [number, number][]): Bounds | null {
  if (coords.length === 0) return null

  let west = coords[0][0]
  let east = coords[0][0]
  let south = coords[0][1]
  let north = coords[0][1]

  for (const [lng, lat] of coords) {
    west = Math.min(west, lng)
    east = Math.max(east, lng)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }

  const pad = 0.05
  return [
    [west - pad, south - pad],
    [east + pad, north + pad],
  ]
}

/** Public Mapbox token; absent in most dev setups, which the UI handles. */
export const MAPBOX_TOKEN = optionalEnv(import.meta.env.VITE_MAPBOX_TOKEN)
