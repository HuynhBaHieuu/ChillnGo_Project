/**
 * The legs of a day's route, each drawn the way it was travelled. The leg's
 * mode is the only thing that decides how (`drawSegment`):
 *
 * - driving, walking, transit: the real route from Mapbox Directions, a solid
 *   line along the roads. Saved journeys carry it (`legRoute`), so viewing one
 *   makes no Directions call; a leg without it is fetched once per session.
 * - flight: the great circle between the airports, bowed a little so a short
 *   domestic hop still reads as a flight, dashed, with a plane at its middle.
 * - ferry: a gentle curve between the piers, dashed, with a boat at its middle.
 *
 * Flights and boats never call Directions, whatever road may join their ends.
 */

import { useEffect, useMemo, useState } from 'react'

import { MAPBOX_TOKEN } from '@/features/map/geometry'
import type { MapStop } from '@/features/map/geometry'
import { isPinned } from '@/lib/itinerary'
import { estimatedSeconds, isRoadMode, legKey, modeOf } from '@/lib/travel'
import type { LegRoute, TravelMode, TripDay, TripLocation } from '@/services/types'

type LngLat = [number, number]

/** One leg: from a stop to the next one in the same day. */
export interface Segment {
  from: MapStop
  to: MapStop
  mode: TravelMode
  /** `legKey`: which cached road route belongs to this leg. */
  key: string
  /** The route saved with the journey, when it still matches the leg. */
  cached?: LegRoute
}

/** Each pair of consecutive stops (all from one day), with how the second was reached. */
export function segmentsOf(stops: MapStop[]): Segment[] {
  return stops.slice(1).map((to, i) => {
    const from = stops[i]
    const key = legKey(from, to, to.mode)
    return { from, to, mode: to.mode, key, cached: to.legRoute?.key === key ? to.legRoute : undefined }
  })
}

/** A leg ready for the map. */
export interface DrawnSegment {
  mode: TravelMode
  coordinates: LngLat[]
  dashed: boolean
  /** The plane or boat at the middle; heading in degrees clockwise from north. */
  icon?: { lng: number; lat: number; heading: number }
  /** Seconds: Directions' estimate on roads, a rough one for flights and boats. Null until known. */
  duration: number | null
  /** True for flights and boats, whose time is worked out from distance alone. */
  estimated: boolean
  /** Metres along the road. Null for flights and boats: no route was measured. */
  distance: number | null
}

/**
 * How a leg is drawn, decided by its mode and nothing else. A road leg whose
 * route has not arrived yet is a straight line until it does.
 */
export function drawSegment(seg: Segment, route: LegRoute | undefined = seg.cached ?? routes.get(seg.key)): DrawnSegment {
  const [a, b]: LngLat[] = [
    [seg.from.lng, seg.from.lat],
    [seg.to.lng, seg.to.lat],
  ]
  switch (seg.mode) {
    case 'flight':
      return arc(seg, 'flight', bow(greatCircle(a, b, 64), 0.15))
    case 'ferry':
      return arc(seg, 'ferry', bow(straight(a, b, 32), 0.08))
    case 'driving':
    case 'walking':
    case 'transit':
      return {
        mode: seg.mode,
        coordinates: route ? decodePolyline(route.polyline) : [a, b],
        dashed: false,
        duration: route?.duration ?? null,
        estimated: false,
        distance: route?.distance ?? null,
      }
  }
}

/** A flight or boat leg along `merc` (Mercator), with its icon placed and pointed at the middle. */
function arc(seg: Segment, mode: 'flight' | 'ferry', merc: LngLat[]): DrawnSegment {
  const i = Math.floor((merc.length - 1) / 2)
  const [p, q] = [merc[i], merc[i + 1] ?? merc[i]]
  const [lng, lat] = unproject([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])
  return {
    mode,
    coordinates: merc.map(unproject),
    dashed: true,
    icon: { lng, lat, heading: Math.atan2(q[0] - p[0], q[1] - p[1]) / RAD },
    duration: estimatedSeconds(mode, seg.from, seg.to),
    estimated: true,
    distance: null,
  }
}

/**
 * The legs among `stops`, drawn. Road legs with no saved route are fetched
 * (each once per session) and redrawn when their route arrives.
 */
export function useDrawnSegments(stops: MapStop[]): DrawnSegment[] {
  const segments = useMemo(() => segmentsOf(stops), [stops])
  const [arrived, setArrived] = useState(0)

  const missingKey = segments
    .filter((s) => isRoadMode(s.mode) && !s.cached && !routes.has(s.key))
    .map((s) => s.key)
    .join('|')

  useEffect(() => {
    if (!missingKey) return
    let current = true
    const missing = segments.filter((s) => isRoadMode(s.mode) && !s.cached && !routes.has(s.key))
    void Promise.all(missing.map((s) => fetchRoute(s.key))).then(() => {
      if (current) setArrived((n) => n + 1)
    })
    return () => {
      current = false
    }
    // Keyed on the legs still missing a route, not on the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey])

  // `arrived` redraws once fetched routes are in the cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => segments.map((s) => drawSegment(s)), [segments, arrived])
}

/* ------------------------------------------------------------- Road routes */

/** Routes fetched this session, by leg key. */
const routes = new Map<string, LegRoute>()
const pending = new Map<string, Promise<LegRoute | null>>()

/**
 * The road route for a leg key, from Mapbox Directions. Null when there is
 * none (an island with no road, a failed request): the leg stays a straight
 * line, and a later view tries again.
 */
function fetchRoute(key: string): Promise<LegRoute | null> {
  const known = routes.get(key)
  if (known) return Promise.resolve(known)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight

  const [profile, coordinates] = key.split(':')
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}` +
    `?geometries=polyline6&overview=full&access_token=${MAPBOX_TOKEN}`

  const request = fetch(url)
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { code?: string; routes?: { geometry: string; duration: number; distance: number }[] } | null) => {
      const best = data?.code === 'Ok' ? data.routes?.[0] : undefined
      if (!best) return null
      const route: LegRoute = { key, polyline: best.geometry, duration: best.duration, distance: best.distance }
      routes.set(key, route)
      return route
    })
    .catch(() => null)
    .finally(() => pending.delete(key))

  pending.set(key, request)
  return request
}

/**
 * The days with each road leg's route attached, for saving: a route still
 * matching its leg is kept, a changed leg (moved stop, new mode) is fetched
 * afresh, and flights, boats and day starts carry none. The server drops any
 * route that does not match its leg, so a stale one is never stored.
 */
export async function withLegRoutes(days: TripDay[]): Promise<TripDay[]> {
  const withoutRoute = ({ legRoute: _dropped, ...loc }: TripLocation): TripLocation => loc

  return Promise.all(
    days.map(async (day) => {
      let previous: TripLocation | null = null
      const locations = await Promise.all(
        day.locations.map(async (loc) => {
          if (!isPinned(loc)) return withoutRoute(loc)
          const from = previous
          previous = loc
          const mode = modeOf(loc)
          if (!from || !isRoadMode(mode)) return withoutRoute(loc)
          const key = legKey(from, loc, mode)
          if (loc.legRoute?.key === key) return loc
          const route = await fetchRoute(key)
          return route ? { ...loc, legRoute: route } : withoutRoute(loc)
        }),
      )
      return { ...day, locations }
    }),
  )
}

/** Google's encoded polyline format, at Mapbox's polyline6 precision, to [lng, lat] pairs. */
function decodePolyline(encoded: string, precision = 6): LngLat[] {
  const factor = 10 ** precision
  const points: LngLat[] = []
  let index = 0
  let lat = 0
  let lng = 0

  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += next()
    lng += next()
    points.push([lng / factor, lat / factor])
  }
  return points
}

/* ----------------------------------------------------- Flight and boat arcs */

const RAD = Math.PI / 180

/** Web Mercator, in radians: straight lines here are straight on screen. */
function project([lng, lat]: LngLat): LngLat {
  return [lng * RAD, Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2))]
}

function unproject([x, y]: LngLat): LngLat {
  return [x / RAD, (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD]
}

/** Points along the great circle from a to b, the shortest path over the globe. */
function greatCircle(a: LngLat, b: LngLat, steps: number): LngLat[] {
  const [l1, p1] = [a[0] * RAD, a[1] * RAD]
  const [l2, p2] = [b[0] * RAD, b[1] * RAD]
  const d =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2),
    )
  if (d === 0) return [a, b]

  const points: LngLat[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    let lng = Math.atan2(y, x) / RAD
    // Keep the line continuous across the antimeridian (lng may pass 180).
    const prev = points.at(-1)
    if (prev) lng += 360 * Math.round((prev[0] - lng) / 360)
    points.push([lng, Math.atan2(z, Math.hypot(x, y)) / RAD])
  }
  return points
}

/** Evenly spaced points on the screen-straight line from a to b. */
function straight(a: LngLat, b: LngLat, steps: number): LngLat[] {
  const [pa, pb] = [project(a), project(b)]
  return Array.from({ length: steps + 1 }, (_, i) =>
    unproject([pa[0] + ((pb[0] - pa[0]) * i) / steps, pa[1] + ((pb[1] - pa[1]) * i) / steps]),
  )
}

/**
 * Bows a path sideways by `amount` of its length at the middle, tapering to
 * nothing at the ends, always towards the north so arcs read like flight maps.
 * Works on screen (Mercator) coordinates, which it returns.
 */
function bow(path: LngLat[], amount: number): LngLat[] {
  const merc = path.map(project)
  const [start, end] = [merc[0], merc[merc.length - 1]]
  const [dx, dy] = [end[0] - start[0], end[1] - start[1]]
  const length = Math.hypot(dx, dy)
  if (length === 0) return merc

  let [nx, ny] = [-dy / length, dx / length]
  if (ny < 0) [nx, ny] = [-nx, -ny]

  return merc.map(([x, y], i) => {
    const lift = Math.sin((Math.PI * i) / (merc.length - 1)) * amount * length
    return [x + nx * lift, y + ny * lift]
  })
}
