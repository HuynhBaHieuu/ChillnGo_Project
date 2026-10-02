/**
 * Travel modes: how a leg between two stops was travelled. The mode alone
 * decides how the map draws a leg (features/map/legs.ts): two airports may well
 * have a road between them, and a flight between them is still a flight.
 */

import type { TravelMode, TripLocation } from '@/services/types'

export const TRAVEL_MODES: readonly TravelMode[] = ['driving', 'walking', 'transit', 'flight', 'ferry']

export const MODE_LABEL: Record<TravelMode, string> = {
  driving: 'Ô tô, xe máy',
  walking: 'Đi bộ',
  transit: 'Xe buýt, xe khách',
  flight: 'Máy bay',
  ferry: 'Tàu, phà, ca nô',
}

/** Modes drawn along real roads, from Mapbox Directions. */
export function isRoadMode(mode: TravelMode): boolean {
  return mode === 'driving' || mode === 'walking' || mode === 'transit'
}

/**
 * A stop's travel mode. Older stops have none and read as driving; `road` and
 * `water` were this field's first values, before walking and transit existed.
 */
export function modeOf(location: { travelMode?: string }): TravelMode {
  switch (location.travelMode) {
    case 'walking':
    case 'transit':
    case 'flight':
    case 'ferry':
      return location.travelMode
    case 'water':
      return 'ferry'
    default:
      return 'driving'
  }
}

type Point = Pick<TripLocation, 'lng' | 'lat'>

/**
 * The Directions profile for a road mode. Mapbox has no public-transport
 * routing, and buses and coaches keep to the roads, so transit is driven.
 */
export function profileOf(mode: TravelMode): 'driving' | 'walking' {
  return mode === 'walking' ? 'walking' : 'driving'
}

/**
 * Names a road leg: its profile and both ends. A cached route belongs to the
 * leg with this key; moving either stop or changing the mode changes the key.
 * The server computes it the same way (server/src/routes/posts.ts).
 */
export function legKey(from: Point, to: Point, mode: TravelMode): string {
  const at = (p: Point) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`
  return `${profileOf(mode)}:${at(from)};${at(to)}`
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Mapbox search categories (poi_category_ids and maki) for airports and for piers. */
const AIRPORT = new Set(['airport'])
const PIER = new Set(['ferry_terminal', 'port', 'ferry', 'harbor', 'marina'])

const isA = (place: Pick<TripLocation, 'placeTypes'>, kinds: Set<string>) =>
  (place.placeTypes ?? []).some((type) => kinds.has(type))

/**
 * The likely way from one place to the next, to prefill a new leg. Only ever a
 * default the author can change; never applied over a mode they chose.
 */
export function suggestMode(
  from: Point & Pick<TripLocation, 'placeTypes'>,
  to: Point & Pick<TripLocation, 'placeTypes'>,
): TravelMode {
  if (isA(from, AIRPORT) && isA(to, AIRPORT)) return 'flight'
  if (isA(from, PIER) && isA(to, PIER)) return 'ferry'
  const typesUnknown = !from.placeTypes?.length || !to.placeTypes?.length
  if (typesUnknown && haversineKm(from, to) > 500) return 'flight'
  return 'driving'
}

/**
 * A rough time for a flight or boat leg, from the straight-line distance: no
 * route was measured, so it is labelled as an estimate and no distance is shown.
 * Flights cruise near 800 km/h plus half an hour to climb and land; boats ~30 km/h.
 */
export function estimatedSeconds(mode: 'flight' | 'ferry', from: Point, to: Point): number {
  const km = haversineKm(from, to)
  return mode === 'flight' ? (km / 800) * 3600 + 30 * 60 : (km / 30) * 3600
}

/** "45 phút", "2 giờ 10 phút". Estimates round to five minutes, so they do not look exact. */
export function formatDuration(seconds: number, estimate = false): string {
  const step = estimate ? 5 : 1
  const minutes = Math.max(step, Math.round(seconds / 60 / step) * step)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`
}
