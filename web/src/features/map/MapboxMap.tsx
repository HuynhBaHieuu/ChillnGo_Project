import 'mapbox-gl/dist/mapbox-gl.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'

import { MAPBOX_TOKEN, boundsOf, dayColor, routeCoordinates } from '@/features/map/geometry'
import type { MapPin, MapStop } from '@/features/map/geometry'
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
  stops: MapStop[]
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
 *
 * With `stops`, every stop is marked in its day's colour and numbered within
 * that day. Picking a day — its chip, or any of its stops — draws that day's
 * route from its first stop to its last and frames it; clicking the map
 * elsewhere, or "Tất cả", goes back to every stop.
 */
export default function MapboxMap({
  route,
  pins,
  stops,
  cluster,
  className,
  label,
}: MapboxMapProps) {
  const routeCoords = useMemo(() => routeCoordinates(route), [route])

  const bounds = useMemo(
    () =>
      boundsOf([
        ...routeCoords,
        ...pins.map((p): [number, number] => [p.lng, p.lat]),
        ...stops.map((s): [number, number] => [s.lng, s.lat]),
      ]),
    [routeCoords, pins, stops],
  )

  // The day whose route is shown; null shows every stop and no route.
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const stopDays = useMemo(() => [...new Set(stops.map((s) => s.day))], [stops])
  // A day can vanish while picked (the itinerary editor deletes days).
  const activeDay = selectedDay !== null && stopDays.includes(selectedDay) ? selectedDay : null
  const dayStops = useMemo(() => stops.filter((s) => s.day === activeDay), [stops, activeDay])

  const dayRoute = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: dayStops.map((s): [number, number] => [s.lng, s.lat]),
      },
      properties: {},
    }),
    [dayStops],
  )

  // Framed on the picked day, or on everything.
  const viewBounds = useMemo(
    () => (dayStops.length ? boundsOf(dayStops.map((s): [number, number] => [s.lng, s.lat])) : bounds),
    [dayStops, bounds],
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
  const boundsKey = viewBounds ? viewBounds.flat().join(',') : ''
  const firstFit = useRef(true)
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false
      return
    }
    if (viewBounds) mapRef.current?.fitBounds(viewBounds, { padding: 56, duration: 600 })
    // Keyed on the numbers, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey])

  if (!bounds || !MAPBOX_TOKEN) return null

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-muted', className)}
      // Stop markers and day chips are buttons, which an image role would hide.
      role={stops.length ? 'group' : 'img'}
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
        onClick={stops.length ? () => setSelectedDay(null) : undefined}
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

        {activeDay !== null && dayStops.length > 1 && (
          <Source id="day-route" type="geojson" data={dayRoute}>
            <Layer
              id="day-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': OUTLINE, 'line-opacity': 0.9, 'line-width': 7 }}
            />
            <Layer
              id="day-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': dayColor(activeDay), 'line-width': 3.5 }}
            />
          </Source>
        )}

        {stops.map((stop) => {
          const dimmed = activeDay !== null && stop.day !== activeDay
          return (
            <Marker
              key={stop.id}
              longitude={stop.lng}
              latitude={stop.lat}
              anchor="center"
              // The picked day's stops sit above the others.
              style={{ zIndex: stop.day === activeDay ? 2 : 1 }}
            >
              <button
                type="button"
                onClick={(event) => {
                  // Not a click on the map, which would clear the pick.
                  event.stopPropagation()
                  setSelectedDay(stop.day)
                }}
                title={`Ngày ${stop.day} · ${stop.order}. ${stop.name || 'Điểm dừng'}`}
                aria-label={`Ngày ${stop.day}, điểm ${stop.order}: ${stop.name || 'Điểm dừng'}. Xem đường đi ngày ${stop.day}`}
                aria-pressed={stop.day === activeDay}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-md transition-[opacity,transform] hover:scale-110',
                  stop.day === activeDay && 'scale-110',
                  dimmed && 'opacity-35',
                )}
                style={{ backgroundColor: dayColor(stop.day) }}
              >
                {stop.order}
              </button>
            </Marker>
          )
        })}

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

      {stopDays.length > 0 && (
        <div className="absolute inset-x-2 top-2 z-10 mr-12 flex gap-1.5 overflow-x-auto pb-1">
          <DayChip active={activeDay === null} onClick={() => setSelectedDay(null)}>
            Tất cả
          </DayChip>
          {stopDays.map((day) => (
            <DayChip key={day} active={activeDay === day} color={dayColor(day)} onClick={() => setSelectedDay(day)}>
              Ngày {day}
            </DayChip>
          ))}
        </div>
      )}

      {stopDays.length > 0 && activeDay === null && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow">
          Chọn một ngày hoặc một điểm để xem đường đi
        </p>
      )}
    </div>
  )
}

function DayChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow transition-colors',
        active ? 'bg-neutral-900 text-white' : 'bg-white/95 text-neutral-800 hover:bg-white',
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </button>
  )
}
