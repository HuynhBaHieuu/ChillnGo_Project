import type { TripDay } from '@/services/types'

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
