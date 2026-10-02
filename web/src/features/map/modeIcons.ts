import { Bus, Car, Footprints, Plane, Ship } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { TravelMode } from '@/services/types'

/** The icon for each travel mode, shared by the editor's picker and the map. */
export const MODE_ICON: Record<TravelMode, LucideIcon> = {
  driving: Car,
  walking: Footprints,
  transit: Bus,
  flight: Plane,
  ferry: Ship,
}
