import type { TripDay, TripLocation } from '@/services/types'

/**
 * Where a new stop sits until the author picks a real place: the centre of
 * Vietnam. It is a placeholder, never a destination, so it is left off maps.
 */
export const UNPINNED = { lng: 106, lat: 16 } as const

/** Whether a stop has a real position (picked from search, or found by name). */
export function isPinned(location: Pick<TripLocation, 'lng' | 'lat'>): boolean {
  return !(location.lng === UNPINNED.lng && location.lat === UNPINNED.lat)
}

/**
 * Sum the estimated cost of every location across every day.
 *
 * Shared between the mock service and the itinerary detail screen so the number
 * the user watches change live is computed the same way the stored total is.
 */
export function totalCostOf(days: TripDay[]): number {
  return days.reduce(
    (total, day) => total + day.locations.reduce((sum, loc) => sum + loc.estCost, 0),
    0,
  )
}

/** Cost of a single day. */
export function dayCostOf(day: TripDay): number {
  return day.locations.reduce((sum, loc) => sum + loc.estCost, 0)
}

/** Immutable array move — used by the drag-and-drop day reorder. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
