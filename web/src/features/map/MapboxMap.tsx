import 'mapbox-gl/dist/mapbox-gl.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/mapbox'
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox'

import { PillTabs } from '@/components/PillNav'
import { MAPBOX_TOKEN, boundsOf, dayColor, routeCoordinates } from '@/features/map/geometry'
import type { MapPin, MapStop } from '@/features/map/geometry'
import { useDrawnSegments } from '@/features/map/legs'
import type { DrawnSegment } from '@/features/map/legs'
import { MODE_ICON } from '@/features/map/modeIcons'
import { mapLanguage, t } from '@/i18n'
import { MODE_LABEL, formatDistance, formatDuration } from '@/lib/travel'
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
  /** The picked day, when the page owns it (its own day tabs): the map's chips are then left out. */
  day?: number | null
  onDayChange?: (day: number | null) => void
}

/**
 * The interactive map.
 *
 * This module is the only thing that imports `mapbox-gl`, and `MapPreview`
 * loads it lazily — so the ~700 kB Mapbox bundle never lands on a page that
 * does not show a map.
 *
 * A `route` is drawn as given: a straight polyline through the stops in order.
 *
 * With `stops`, every stop is marked in its day's colour and numbered within
 * that day. Picking a day — its chip, or any of its stops — draws that day's
 * route from its first stop to its last and frames it; clicking the map
 * elsewhere, or "Tất cả", goes back to every stop. Each leg is drawn the way
 * it was travelled (see legs.ts): road legs follow the real roads, flights and
 * boats are dashed arcs with a plane or boat on them. Tapping a leg labels it
 * with how it was travelled and how long it took.
 */
export default function MapboxMap({
  route,
  pins,
  stops,
  cluster,
  className,
  label,
  day,
  onDayChange,
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
  const [ownDay, setOwnDay] = useState<number | null>(null)
  const controlled = onDayChange !== undefined
  const selectedDay = controlled ? (day ?? null) : ownDay
  const setSelectedDay = onDayChange ?? setOwnDay
  const stopDays = useMemo(() => [...new Set(stops.map((s) => s.day))], [stops])
  // A day can vanish while picked (the itinerary editor deletes days).
  const activeDay = selectedDay !== null && stopDays.includes(selectedDay) ? selectedDay : null
  const dayStops = useMemo(() => stops.filter((s) => s.day === activeDay), [stops, activeDay])

  // The picked day's legs, each drawn by its mode (legs.ts).
  const segments = useDrawnSegments(dayStops)
  const solidData = useMemo(() => lines(segments, false), [segments])
  const dashedData = useMemo(() => lines(segments, true), [segments])

  // The leg whose label is open, and where it was tapped. Closed when the day changes.
  const [picked, setPicked] = useState<{ day: number; index: number; lng: number; lat: number } | null>(null)
  const pickedSegment = picked && picked.day === activeDay ? segments[picked.index] : undefined

  function onMapClick(event: MapMouseEvent) {
    const index = (event.features?.[0] as { properties?: { index?: unknown } | null } | undefined)?.properties?.index
    if (activeDay !== null && typeof index === 'number') {
      setPicked({ day: activeDay, index, lng: event.lngLat.lng, lat: event.lngLat.lat })
      return
    }
    setPicked(null)
    if (stops.length) setSelectedDay(null)
  }

  // Framed on the picked day (arcs included, they bow outside the stops), or on everything.
  const viewBounds = useMemo(
    () =>
      dayStops.length
        ? boundsOf([
            ...dayStops.map((s): [number, number] => [s.lng, s.lat]),
            ...segments.filter((s) => s.dashed).flatMap((s) => s.coordinates),
          ])
        : bounds,
    [dayStops, segments, bounds],
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
        language={mapLanguage()}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 56 } }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        // Taps on a leg (the wide, invisible hit lines) open its label.
        interactiveLayerIds={activeDay !== null ? ['day-solid-hit', 'day-dashed-hit'] : undefined}
        onClick={onMapClick}
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

        {/* Road legs: solid, along the roads. */}
        {activeDay !== null && solidData.features.length > 0 && (
          <Source id="day-solid" type="geojson" data={solidData}>
            <Layer
              id="day-solid-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': OUTLINE, 'line-opacity': 0.9, 'line-width': 7 }}
            />
            <Layer
              id="day-solid-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': dayColor(activeDay), 'line-width': 3.5 }}
            />
            <Layer id="day-solid-hit" type="line" paint={{ 'line-color': OUTLINE, 'line-opacity': 0, 'line-width': 18 }} />
          </Source>
        )}

        {/* Flights and boats: dashed arcs. */}
        {activeDay !== null && dashedData.features.length > 0 && (
          <Source id="day-dashed" type="geojson" data={dashedData}>
            <Layer
              id="day-dashed-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': OUTLINE, 'line-opacity': 0.9, 'line-width': 6 }}
            />
            <Layer
              id="day-dashed-line"
              type="line"
              // Butt caps: round ones swell each dash into a blob.
              layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
              paint={{ 'line-color': dayColor(activeDay), 'line-width': 3, 'line-dasharray': [2, 1.5] }}
            />
            <Layer id="day-dashed-hit" type="line" paint={{ 'line-color': OUTLINE, 'line-opacity': 0, 'line-width': 18 }} />
          </Source>
        )}

        {activeDay !== null &&
          segments.map(
            (segment, index) =>
              segment.icon && (
                <ModeIcon
                  key={index}
                  segment={segment}
                  color={dayColor(activeDay)}
                  onClick={() => setPicked({ day: activeDay, index, lng: segment.icon!.lng, lat: segment.icon!.lat })}
                />
              ),
          )}

        {picked && pickedSegment && (
          <Popup
            longitude={picked.lng}
            latitude={picked.lat}
            anchor="bottom"
            offset={14}
            closeButton={false}
            closeOnClick={false}
            maxWidth="16rem"
          >
            <SegmentLabel segment={pickedSegment} />
          </Popup>
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
                title={`${t('Ngày {n}', { n: stop.day })} · ${stop.order}. ${stop.name || t('Điểm dừng#one')}`}
                aria-label={t('Ngày {day}, điểm {order}: {name}. Xem đường đi ngày {day}', {
                  day: stop.day,
                  order: stop.order,
                  name: stop.name || t('Điểm dừng#one'),
                })}
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

      {stopDays.length > 0 && !controlled && (
        // The navbar's pills; 0 stands for "every day". Clear of the zoom buttons on the right.
        <div className="absolute left-2 right-12 top-2 z-10 flex">
          <PillTabs
            label={t('Chọn ngày để xem đường đi')}
            value={activeDay ?? 0}
            onChange={(day) => setSelectedDay(day || null)}
            items={[
              { value: 0, label: t('Tất cả') },
              ...stopDays.map((day) => ({
                value: day,
                label: t('Ngày {n}', { n: day }),
                leading: <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(day) }} aria-hidden />,
              })),
            ]}
            className="max-w-full shadow-md"
          />
        </div>
      )}

      {stopDays.length > 0 && activeDay === null && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow">
          {t('Chọn một ngày hoặc một điểm để xem đường đi')}
        </p>
      )}
    </div>
  )
}

/** GeoJSON lines for a Source: the dashed legs or the solid ones, each tagged with its index for taps. */
function lines(segments: DrawnSegment[], dashed: boolean) {
  return {
    type: 'FeatureCollection' as const,
    features: segments.flatMap((segment, index) =>
      segment.dashed === dashed
        ? [
            {
              type: 'Feature' as const,
              geometry: { type: 'LineString' as const, coordinates: segment.coordinates },
              properties: { index },
            },
          ]
        : [],
    ),
  }
}

/** The plane or boat riding a flight or ferry leg; tapping it opens the leg's label. The plane points along its course. */
function ModeIcon({ segment, color, onClick }: { segment: DrawnSegment; color: string; onClick: () => void }) {
  if (!segment.icon) return null
  const flight = segment.mode === 'flight'
  const Icon = MODE_ICON[segment.mode]
  return (
    <Marker
      longitude={segment.icon.lng}
      latitude={segment.icon.lat}
      anchor="center"
      // Lucide's plane points north-east (45°); turning with the map keeps it on course.
      rotation={flight ? segment.icon.heading - 45 : 0}
      rotationAlignment={flight ? 'map' : 'viewport'}
      style={{ zIndex: 0 }}
    >
      <button
        type="button"
        onClick={(event) => {
          // Not a click on the map, which would close the label.
          event.stopPropagation()
          onClick()
        }}
        aria-label={t('{mode}: xem thời gian', { mode: MODE_LABEL[segment.mode] })}
        className="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 bg-white shadow-md"
        style={{ borderColor: color, color }}
      >
        <Icon className="size-4" fill={flight ? color : 'none'} strokeWidth={flight ? 1.5 : 2} aria-hidden />
      </button>
    </Marker>
  )
}

/**
 * What a tapped leg says: how it was travelled and roughly how long it took.
 * Road legs add the distance Directions measured; flights and boats show an
 * estimated time and no distance, since no route was measured for them.
 */
function SegmentLabel({ segment }: { segment: DrawnSegment }) {
  const Icon = MODE_ICON[segment.mode]
  const time =
    segment.duration === null
      ? null
      : segment.estimated
        ? t('khoảng {time} (ước tính)', { time: formatDuration(segment.duration, true) })
        : formatDuration(segment.duration, false)
  return (
    <div className="flex items-start gap-2 text-neutral-800">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-xs leading-snug">
        <p className="font-semibold">{MODE_LABEL[segment.mode]}</p>
        {time && <p>{time}</p>}
        {segment.distance !== null && <p className="text-neutral-500">{formatDistance(segment.distance)}</p>}
        {segment.duration === null && <p className="text-neutral-500">{t('Chưa có dữ liệu thời gian')}</p>}
      </div>
    </div>
  )
}
