/**
 * Places for check-ins: search by name, the device's own position, and map
 * images. Uses Mapbox (the same public token as the maps); without a token,
 * search is unavailable but "use my location" still works, without a place name.
 */

import { MAPBOX_TOKEN } from '@/features/map/geometry'

export interface Place {
  name: string
  address: string
  lat: number
  lng: number
  /** Mapbox categories (e.g. "airport", "ferry"), which suggest how a leg was travelled. */
  types?: string[]
}

export const canSearchPlaces = Boolean(MAPBOX_TOKEN)

/**
 * Mapbox Search Box API. Chosen over the older Geocoding API because it knows
 * Vietnamese points of interest: "Phố cổ Hội An" or "Chợ Bến Thành" come back
 * as themselves instead of as unrelated street names.
 */
const SEARCH = 'https://api.mapbox.com/search/searchbox/v1'

interface Feature {
  geometry: { coordinates: [number, number] }
  properties: {
    name: string
    full_address?: string
    place_formatted?: string
    poi_category_ids?: string[]
    maki?: string
  }
}

function toPlace(feature: Feature): Place {
  const { name, place_formatted, full_address, poi_category_ids = [], maki } = feature.properties
  const [lng, lat] = feature.geometry.coordinates
  const types = [...new Set([...poi_category_ids, ...(maki ? [maki] : [])])]
  return { name, address: place_formatted || full_address || '', lat, lng, types }
}

/** Mapbox often lists the same place several times: keep the first of each name + address. */
function distinct(places: Place[]): Place[] {
  const seen = new Set<string>()
  return places.filter((p) => {
    const key = `${p.name.toLowerCase()}|${p.address.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Places matching `query`, nearest to the user first (Mapbox guesses from their IP). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) return []
  const params = new URLSearchParams({
    q: query.trim(),
    access_token: MAPBOX_TOKEN,
    language: 'vi',
    limit: '8',
    proximity: 'ip',
  })
  const response = await fetch(`${SEARCH}/forward?${params}`, { signal })
  if (!response.ok) throw new Error('Không tìm được địa điểm lúc này. Vui lòng thử lại.')
  const data = (await response.json()) as { features: Feature[] }
  return distinct(data.features.map(toPlace)).slice(0, 6)
}

/** The named place at a position, or null when Mapbox has none. */
export async function placeAt(lat: number, lng: number): Promise<Place | null> {
  if (!MAPBOX_TOKEN) return null
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: MAPBOX_TOKEN,
    language: 'vi',
    limit: '1',
  })
  const response = await fetch(`${SEARCH}/reverse?${params}`)
  if (!response.ok) return null
  const data = (await response.json()) as { features: Feature[] }
  const first = data.features[0]
  // Keep the device's own coordinates: more precise than the feature's.
  return first ? { ...toPlace(first), lat, lng } : null
}

/** Asks the browser for the device's position. Rejects with a message ready to show. */
export function getDevicePosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Trình duyệt này không hỗ trợ lấy vị trí. Hãy tìm địa điểm bằng tên.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]:
            'Bạn chưa cho phép ChillnGo dùng vị trí. Hãy bật quyền vị trí cho trang này trong trình duyệt, hoặc tìm địa điểm bằng tên.',
          [error.POSITION_UNAVAILABLE]: 'Không xác định được vị trí của thiết bị. Hãy tìm địa điểm bằng tên.',
          [error.TIMEOUT]: 'Lấy vị trí quá lâu. Vui lòng thử lại.',
        }
        reject(new Error(messages[error.code] ?? 'Không lấy được vị trí.'))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

/** A small static street map with a pin, for check-in cards. Null without a token. */
export function staticMapUrl(lat: number, lng: number, width: number, height: number): string | null {
  if (!MAPBOX_TOKEN) return null
  const pin = `pin-m+d60072(${lng},${lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
