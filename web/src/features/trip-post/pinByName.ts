import { searchPlaces } from '@/lib/geo'
import { isPinned } from '@/lib/itinerary'
import type { TripDay } from '@/services/types'

/**
 * Stops described but never pinned get the first place Mapbox finds for their
 * address (or, without one, their name), so a typed address still lands on the
 * map. What was typed is kept. Stops nothing is found for stay off the map.
 */
export async function pinByName(days: TripDay[]): Promise<TripDay[]> {
  const queryOf = (l: TripDay['locations'][number]) => (l.address?.trim() || l.name).trim()
  const todo = days.flatMap((d) => d.locations).filter((l) => !isPinned(l) && queryOf(l).length >= 2)
  if (todo.length === 0) return days
  const found = new Map<string, { lng: number; lat: number }>()
  await Promise.all(
    todo.map(async (loc) => {
      const [place] = await searchPlaces(queryOf(loc)).catch(() => [])
      if (place) found.set(loc._id, { lng: place.lng, lat: place.lat })
    }),
  )
  if (found.size === 0) return days
  return days.map((day) => ({
    ...day,
    locations: day.locations.map((loc) => ({ ...loc, ...found.get(loc._id) })),
  }))
}
