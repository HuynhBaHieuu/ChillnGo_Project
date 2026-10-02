/**
 * Turning what an author pastes or types into a position on the map:
 *
 *   - a Google Maps link, full or shortened (maps.app.goo.gl/…),
 *   - coordinates ("15.8801, 108.3380"),
 *   - or plain text, looked up with Mapbox search.
 *
 * Short links are followed by the API (server/src/routes/geo.ts), since
 * Google does not let a browser read them cross-origin.
 */

import { placeAt, searchPlaces } from '@/lib/geo'
import { http } from '@/services/http'

export interface ResolvedPlace {
  lat: number
  lng: number
  /** A readable address, when one could be found. */
  address: string
  /** The place's own name, when the link carried one (Google's /place/<name>/). */
  name?: string
  /** Mapbox categories, when the place came from search (see `Place.types`). */
  types?: string[]
}

function inRange(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** "15.8801, 108.3380" or "15.8801 108.3380" → position; anything else → null. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const match = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  return inRange(lat, lng) ? { lat, lng } : null
}

export function isGoogleMapsUrl(text: string): boolean {
  try {
    const { hostname } = new URL(text.trim())
    return /(^|\.)google\.[a-z.]+$/.test(hostname) || hostname === 'maps.app.goo.gl' || hostname === 'goo.gl'
  } catch {
    return false
  }
}

function isShortLink(url: URL): boolean {
  return url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl'
}

/**
 * What a full Google Maps link says about a place. `!3d…!4d…` is the place
 * itself; `@lat,lng` is only where the map was centred, so it comes second.
 */
export function readGoogleMapsUrl(raw: string): { lat?: number; lng?: number; name?: string; query?: string } {
  const url = new URL(raw)
  let text = url.href
  try {
    text = decodeURIComponent(url.href)
  } catch {
    // A stray % in the link: read it as it is.
  }

  const name = url.pathname.match(/\/place\/([^/]+)/)?.[1]
  const placeName = name ? decodeURIComponent(name).replace(/\+/g, ' ').trim() : undefined

  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pin && inRange(Number(pin[1]), Number(pin[2]))) {
    return { lat: Number(pin[1]), lng: Number(pin[2]), name: placeName }
  }

  for (const key of ['q', 'query', 'll', 'destination', 'center']) {
    const value = url.searchParams.get(key)
    if (!value) continue
    const coords = parseCoordinates(value)
    if (coords) return { ...coords, name: placeName }
    if (key === 'q' || key === 'query' || key === 'destination') return { query: value, name: placeName }
  }

  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at && inRange(Number(at[1]), Number(at[2]))) {
    return { lat: Number(at[1]), lng: Number(at[2]), name: placeName }
  }

  return { name: placeName, query: placeName }
}

/** A readable address for a position, or the coordinates when Mapbox has none. */
async function addressAt(lat: number, lng: number): Promise<string> {
  const place = await placeAt(lat, lng).catch(() => null)
  if (!place) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  return [place.name, place.address].filter(Boolean).join(', ')
}

/** Looks a text up with Mapbox; the first result wins. */
async function lookUp(text: string): Promise<ResolvedPlace> {
  const [place] = await searchPlaces(text)
  if (!place) throw new Error('Không tìm thấy địa chỉ này. Hãy thử dán link Google Maps hoặc chọn trên bản đồ.')
  return { lat: place.lat, lng: place.lng, address: [place.name, place.address].filter(Boolean).join(', '), types: place.types }
}

/**
 * Resolves a pasted Google Maps link or typed coordinates. Plain text is not
 * handled here: the address field shows search suggestions for that instead.
 * Throws with a message ready to show.
 */
export async function resolveLinkOrCoordinates(input: string): Promise<ResolvedPlace> {
  const text = input.trim()

  const coords = parseCoordinates(text)
  if (coords) return { ...coords, address: await addressAt(coords.lat, coords.lng) }

  if (!isGoogleMapsUrl(text)) throw new Error('Không nhận ra link hay toạ độ này.')

  let full = text
  if (isShortLink(new URL(text))) {
    const { url } = await http<{ url: string }>(`/api/geo/resolve-maps-link?url=${encodeURIComponent(text)}`)
    full = url
  }

  const info = readGoogleMapsUrl(full)
  if (info.lat !== undefined && info.lng !== undefined) {
    const address = info.name ?? (await addressAt(info.lat, info.lng))
    return { lat: info.lat, lng: info.lng, address, name: info.name }
  }
  if (info.query) return { ...(await lookUp(info.query)), name: info.name }
  throw new Error('Link Google Maps này không có vị trí. Hãy mở địa điểm trên Google Maps rồi bấm Chia sẻ → Sao chép đường liên kết.')
}

/** True when the text should be resolved as a link or coordinates rather than searched as an address. */
export function looksLikeLinkOrCoordinates(text: string): boolean {
  return parseCoordinates(text) !== null || isGoogleMapsUrl(text)
}

/** Google Maps search for a name or address, to find a place and copy it back. */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim() || 'Việt Nam')}`
}
