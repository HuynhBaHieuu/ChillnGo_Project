import 'mapbox-gl/dist/mapbox-gl.css'

import { useMemo } from 'react'
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/mapbox'

import { MAPBOX_TOKEN, boundsOf, routeCoordinates } from '@/features/map/geometry'
import type { MapPin } from '@/features/map/geometry'
import { cn } from '@/lib/utils'
import type { RouteGeoJson } from '@/services/types'

const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'

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

  if (!bounds || !MAPBOX_TOKEN) return null

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-white/5', className)}
      role="img"
      aria-label={label}
    >
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={MAP_STYLE}
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
              paint={{ 'line-color': '#000000', 'line-opacity': 0.4, 'line-width': 6 }}
            />
            <Layer
              id="trip-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#ffffff', 'line-width': 2.5 }}
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
                'circle-color': 'rgba(255,255,255,0.9)',
                'circle-radius': ['step', ['get', 'point_count'], 16, 3, 22, 6, 28],
                'circle-stroke-width': 1.4,
                'circle-stroke-color': 'rgba(255,255,255,0.45)',
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
              paint={{ 'text-color': '#0a0a0a' }}
            />
            <Layer
              id="pin-single"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': '#ffffff',
                'circle-radius': 6,
                'circle-stroke-width': 1.4,
                'circle-stroke-color': 'rgba(0,0,0,0.5)',
              }}
            />
          </Source>
        )}

        {/* Un-clustered route stops get numbered markers. */}
        {!cluster &&
          routeCoords.map(([lng, lat], i) => (
            <Marker key={`${lng},${lat},${i}`} longitude={lng} latitude={lat} anchor="center">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {i + 1}
              </span>
            </Marker>
          ))}
      </Map>
    </div>
  )
}
