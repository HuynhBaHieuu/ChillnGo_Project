import { Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { canSearchPlaces, searchPlaces } from '@/lib/geo'
import type { Place } from '@/lib/geo'
import type { TripLocation } from '@/services/types'

interface PlaceFieldProps {
  id: string
  label: string
  location: TripLocation
  onChange: (patch: Partial<TripLocation>) => void
}

/**
 * A stop's name, with place suggestions as the author types (Mapbox search,
 * the same one check-ins use). Picking a suggestion also fills the address and
 * pins the stop on the map; the address field below shows the pin.
 */
export function PlaceField({ id, label, location, onChange }: PlaceFieldProps) {
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search once the author pauses typing; drop answers to older queries.
  useEffect(() => {
    const q = query?.trim() ?? ''
    if (!canSearchPlaces || q.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchPlaces(q, controller.signal)
        .then((places) => {
          setResults(places)
          setError(null)
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setError((e as Error).message)
        })
        .finally(() => setSearching(false))
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const open = query !== null && query.trim().length >= 2 && results.length > 0

  function pick(place: Place) {
    onChange({
      name: place.name,
      address: [place.name, place.address].filter(Boolean).join(', '),
      lng: place.lng,
      lat: place.lat,
    })
    setQuery(null)
    setResults([])
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          value={location.name}
          aria-label={label}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={canSearchPlaces ? 'Gõ tên địa điểm, rồi chọn một gợi ý' : undefined}
          onChange={(e) => {
            onChange({ name: e.target.value })
            setQuery(e.target.value)
          }}
          onBlur={() => window.setTimeout(() => setQuery(null), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery(null)
            if (e.key === 'Enter' && open) {
              e.preventDefault()
              pick(results[0])
            }
          }}
          className="pr-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="np-overlay absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl p-1"
        >
          {results.map((place, i) => (
            <li key={`${place.lng},${place.lat},${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(place)
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-np-hover"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[hsl(var(--np-ochre))]" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-np-cream">{place.name}</span>
                  {place.address && <span className="block truncate text-xs text-muted-foreground">{place.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
