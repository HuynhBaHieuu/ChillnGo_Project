import 'mapbox-gl/dist/mapbox-gl.css'

import { useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'

import { MAPBOX_TOKEN, boundsOf, routeCoordinates } from '@/features/map/geometry'
import type { MapPin } from '@/features/map/geometry'
import { cn } from '@/lib/utils'
import type { RouteGeoJson } from '@/services/types'

/**
 * Mapbox Streets: the light, full-colour street map (roads, water, parks)
 * closest to Google Maps. The route and pins below are coloured for it.
 */
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

/** ChillnGo's pink (tertiary ink) and white outlines, so marks read over busy map colours. */
const ROUTE = '#D60072'
const PIN = '#FF3DA5'
const INK = '#1A0B3C'
const OUTLINE = '#FFFFFF'

interface MapboxMapProps {
  route?: RouteGeoJson
  pins: MapPin[]
  cluster: boolean
  className?: string
  label: string
}

/**
 * The interactive map.
 *
 * This module is the only thing that imports `mapbox-gl`, and `MapPreview`
 * loads it lazily — so the ~700 kB Mapbox bundle never lands on a page that
 * does not show a map.
 *
 * The geometry is always mock data shipped with the post. No Directions API
 * call is made; the "route" is a straight polyline through the stops in order,
 * which is what the fixtures encode.
 */
export default function MapboxMap({
  route,
  pins,
  cluster,
  className,
  label,
}: MapboxMapProps) {
  const routeCoords = useMemo(() => routeCoordinates(route), [route])

  const bounds = useMemo(
    () =>
      boundsOf([...routeCoords, ...pins.map((p): [number, number] => [p.lng, p.lat])]),
    [routeCoords, pins],
  )

  const pinCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pins.map((pin) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] },
        properties: { id: pin.id, label: pin.label, weight: pin.weight ?? 1 },
      })),
    }),
    [pins],
  )

  // initialViewState only applies once: refit when the route changes later
  // (the editor's live preview gains stops as the author pins them).
  const mapRef = useRef<MapRef>(null)
  const boundsKey = bounds ? bounds.flat().join(',') : ''
  const firstFit = useRef(true)
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false
      return
    }
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 56, duration: 600 })
    // Keyed on the numbers, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey])

  if (!bounds || !MAPBOX_TOKEN) return null

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-muted', className)}
      role="img"
      aria-label={label}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAP_STYLE}
        // Place names in Vietnamese where Mapbox has them, local names otherwise.
        language="vi"
        initialViewState={{ bounds, fitBoundsOptions: { padding: 56 } }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {route && routeCoords.length > 1 && (
          <Source id="trip-route" type="geojson" data={route}>
            <Layer
              id="trip-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': OUTLINE, 'line-opacity': 0.9, 'line-width': 7 }}
            />
            <Layer
              id="trip-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': ROUTE, 'line-width': 3.5 }}
            />
          </Source>
        )}

        {cluster && pins.length > 0 && (
          <Source
            id="trip-pins"
            type="geojson"
            data={pinCollection}
            cluster
            clusterRadius={48}
            clusterMaxZoom={12}
          >
            <Layer
              id="pin-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': PIN,
                'circle-radius': ['step', ['get', 'point_count'], 16, 3, 22, 6, 28],
                'circle-stroke-width': 2,
                'circle-stroke-color': OUTLINE,
              }}
            />
            <Layer
              id="pin-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': '{point_count_abbreviated}',
                'text-size': 12,
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              }}
              paint={{ 'text-color': INK }}
            />
            <Layer
              id="pin-single"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': ROUTE,
                'circle-radius': 7,
                'circle-stroke-width': 2,
                'circle-stroke-color': OUTLINE,
              }}
            />
          </Source>
        )}

        {/* Un-clustered route stops get numbered markers. */}
        {!cluster &&
          routeCoords.map(([lng, lat], i) => (
            <Marker key={`${lng},${lat},${i}`} longitude={lng} latitude={lat} anchor="center">
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary text-[11px] font-semibold text-primary-foreground shadow-md">
                {i + 1}
              </span>
            </Marker>
          ))}
      </Map>
    </div>
  )
}
