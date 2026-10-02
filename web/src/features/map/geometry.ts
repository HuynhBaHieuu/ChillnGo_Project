import { optionalEnv } from '@/lib/env'
import { isPinned } from '@/lib/itinerary'
import { modeOf } from '@/lib/travel'
import type { LegRoute, RouteGeoJson, TravelMode, TripDay } from '@/services/types'

export interface MapPin {
  id: string
  lng: number
  lat: number
  label: string
  /** Extra data carried through to the clustered source (e.g. bookmark count). */
  weight?: number
}

/** One stop of a trip, placed on the map with its day and its place in that day. */
export interface MapStop {
  id: string
  lng: number
  lat: number
  name: string
  /** 1-based day number. */
  day: number
  /** 1-based position among the day's stops that are on the map. */
  order: number
  /** How this stop was reached from the previous one in its day. */
  mode: TravelMode
  /** The road route into this stop, if one was cached when the journey was saved. */
  legRoute?: LegRoute
}

/** Every stop that has a real position, day by day, in itinerary order. */
export function stopsOfDays(days: TripDay[]): MapStop[] {
  return days.flatMap((day, d) =>
    day.locations.filter(isPinned).map((loc, i) => ({
      id: loc._id,
      lng: loc.lng,
      lat: loc.lat,
      name: loc.name,
      day: d + 1,
      order: i + 1,
      mode: modeOf(loc),
      legRoute: loc.legRoute,
    })),
  )
}

/** Marker and route colour per day, picked to stand out on the street map. */
const DAY_COLORS = ['#D60072', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2', '#DC2626', '#4D7C0F']

export function dayColor(day: number): string {
  return DAY_COLORS[(day - 1) % DAY_COLORS.length]
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
