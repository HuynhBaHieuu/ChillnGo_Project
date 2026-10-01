/**
 * The legs of a day's route, drawn the way each one was travelled.
 *
 * - `road`: the real driving route, from the Mapbox Directions API, like a GPS.
 * - `flight`: the great circle between the two airports, bowed a little so a
 *   short domestic hop still reads as a flight, with a plane at its middle.
 * - `water`: a gentle curve between the two piers, with a boat at its middle.
 */

import { useEffect, useMemo, useState } from 'react'

import { MAPBOX_TOKEN } from '@/features/map/geometry'
import type { MapStop } from '@/features/map/geometry'
import type { TravelMode } from '@/services/types'

type LngLat = [number, number]

export interface Leg {
  from: MapStop
  to: MapStop
  mode: TravelMode
}

/** Each pair of consecutive stops, with how the second one was reached. */
export function legsOf(stops: MapStop[]): Leg[] {
  return stops.slice(1).map((to, i) => ({ from: stops[i], to, mode: to.mode }))
}

const pointOf = (stop: MapStop): LngLat => [stop.lng, stop.lat]

/* ----------------------------------------------------- Flight and water arcs */

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

export interface ArcLeg {
  mode: 'flight' | 'water'
  coordinates: LngLat[]
  /** Where the plane or boat sits, and its heading in degrees clockwise from north. */
  icon: { lng: number; lat: number; heading: number }
}

export function arcOf(leg: Leg & { mode: 'flight' | 'water' }): ArcLeg {
  const [a, b] = [pointOf(leg.from), pointOf(leg.to)]
  const merc = leg.mode === 'flight' ? bow(greatCircle(a, b, 64), 0.15) : bow(straight(a, b, 32), 0.08)

  // Heading at the middle, from the two points either side of it.
  const i = Math.floor((merc.length - 1) / 2)
  const [p, q] = [merc[i], merc[i + 1] ?? merc[i]]
  const [lng, lat] = unproject([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])

  return {
    mode: leg.mode,
    coordinates: merc.map(unproject),
    icon: { lng, lat, heading: Math.atan2(q[0] - p[0], q[1] - p[1]) / RAD },
  }
}

/* ---------------------------------------------------------------- Road legs */

/** The Directions API takes at most 25 waypoints per request. */
const MAX_WAYPOINTS = 25

const coordsKey = (points: LngLat[]) => points.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';')

/** Every route asked for this session, so picking a day again draws it at once. */
const routeCache = new Map<string, Promise<LngLat[]>>()

async function drivingRoute(points: LngLat[]): Promise<LngLat[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsKey(points)}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Directions ${response.status}`)
  const data = (await response.json()) as { code: string; routes?: { geometry: { coordinates: LngLat[] } }[] }
  const coordinates = data.routes?.[0]?.geometry.coordinates
  if (data.code !== 'Ok' || !coordinates?.length) throw new Error(`Directions ${data.code}`)
  return coordinates
}

/**
 * The road route through `points` in order. A stretch with no road between
 * (an island with no ferry, a failed request) falls back to a straight line.
 */
function roadPath(points: LngLat[]): Promise<LngLat[]> {
  const key = coordsKey(points)
  const cached = routeCache.get(key)
  if (cached) return cached

  // Chunks share their end points so the pieces join up.
  const chunks: LngLat[][] = []
  for (let i = 0; i < points.length - 1; i += MAX_WAYPOINTS - 1) {
    chunks.push(points.slice(i, i + MAX_WAYPOINTS))
  }

  let failed = false
  const route = Promise.all(
    chunks.map((chunk) =>
      drivingRoute(chunk).catch(() => {
        failed = true
        return chunk
      }),
    ),
  ).then((pieces) => {
    // Do not keep a fallback: a network blip should not stick for the session.
    if (failed) routeCache.delete(key)
    return pieces.flatMap((piece, i) => (i === 0 ? piece : piece.slice(1)))
  })

  routeCache.set(key, route)
  return route
}

/** Runs of consecutive road legs, each as the stops it passes, in order. */
function roadRuns(stops: MapStop[]): LngLat[][] {
  const runs: MapStop[][] = []
  for (const leg of legsOf(stops)) {
    if (leg.mode !== 'road') continue
    const run = runs.at(-1)
    if (run && run.at(-1) === leg.from) run.push(leg.to)
    else runs.push([leg.from, leg.to])
  }
  return runs.map((run) => run.map(pointOf))
}

/**
 * The road legs among `stops`, following real roads once the Directions API
 * answers, and as straight lines until then.
 */
export function useRoadPaths(stops: MapStop[]): LngLat[][] {
  const runs = useMemo(() => roadRuns(stops), [stops])
  const key = runs.map(coordsKey).join('|')
  const [loaded, setLoaded] = useState<{ key: string; paths: LngLat[][] } | null>(null)

  useEffect(() => {
    if (runs.length === 0) return
    let current = true
    void Promise.all(runs.map(roadPath)).then((paths) => {
      if (current) setLoaded({ key, paths })
    })
    return () => {
      current = false
    }
    // Keyed on the coordinates, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return loaded?.key === key ? loaded.paths : runs
}
