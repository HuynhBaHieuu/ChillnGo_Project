/**
 * Public entry point for the map surface.
 *
 * The implementation lives in `features/map` (it owns the Mapbox dependency and
 * the no-token fallback); this re-export keeps the shared-component import path
 * uniform: `@/components/MapPreview`.
 */
export { MapPreview, type MapPin } from '@/features/map/MapPreview'
