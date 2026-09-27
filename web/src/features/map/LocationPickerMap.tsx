import 'mapbox-gl/dist/mapbox-gl.css'

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox'

import { MAPBOX_TOKEN } from '@/features/map/geometry'

interface LocationPickerMapProps {
  value: { lat: number; lng: number } | null
  onChange: (position: { lat: number; lng: number }) => void
}

/** Vietnam as a whole, for a stop that has no position yet. */
const VIETNAM = { longitude: 106, latitude: 16, zoom: 4.6 }

/**
 * A map to put a stop on: click to drop the pin, drag it to adjust. Loaded
 * lazily by MapPickerDialog, like MapboxMap, so Mapbox is only fetched once
 * the picker opens.
 */
export default function LocationPickerMap({ value, onChange }: LocationPickerMapProps) {
  if (!MAPBOX_TOKEN) return null

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      language="vi"
      initialViewState={value ? { longitude: value.lng, latitude: value.lat, zoom: 14 } : VIETNAM}
      attributionControl={false}
      cursor="crosshair"
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {value && (
        <Marker
          longitude={value.lng}
          latitude={value.lat}
          anchor="bottom"
          draggable
          color="#D9803E"
          onDragEnd={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        />
      )}
    </Map>
  )
}
