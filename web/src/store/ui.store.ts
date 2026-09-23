/**
 * Transient UI state that more than one component needs to agree on.
 *
 * Deliberately small: anything that belongs to a single screen stays in that
 * screen's `useState`, and anything that comes from the API lives in TanStack
 * Query, not here.
 */

import { create } from 'zustand'

type DiscoverView = 'grid' | 'map'

interface UiState {
  /** Mobile nav sheet (navbar hamburger). */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void

  /** Discover: filter sheet on mobile, and grid/map toggle on every size. */
  filterSheetOpen: boolean
  setFilterSheetOpen: (open: boolean) => void
  discoverView: DiscoverView
  setDiscoverView: (view: DiscoverView) => void
}

export const useUiStore = create<UiState>()((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

  filterSheetOpen: false,
  setFilterSheetOpen: (filterSheetOpen) => set({ filterSheetOpen }),

  discoverView: 'grid',
  setDiscoverView: (discoverView) => set({ discoverView }),
}))
