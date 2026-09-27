import { AlertCircle, ExternalLink, Loader2, Map as MapIcon, MapPin } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPickerDialog } from '@/features/trip-post/components/MapPickerDialog'
import { canSearchPlaces, googleMapsUrl, searchPlaces } from '@/lib/geo'
import type { Place } from '@/lib/geo'
import { UNPINNED, isPinned } from '@/lib/itinerary'
import { googleMapsSearchUrl, looksLikeLinkOrCoordinates, resolveLinkOrCoordinates } from '@/lib/mapsLink'
import type { ResolvedPlace } from '@/lib/mapsLink'
import { cn } from '@/lib/utils'
import type { TripLocation } from '@/services/types'

interface AddressFieldProps {
  id: string
  label: string
  location: TripLocation
  onChange: (patch: Partial<TripLocation>) => void
}

/**
 * Where a stop is. Three ways in:
 *
 *   - type an address and pick a suggestion,
 *   - paste a Google Maps link (full or maps.app.goo.gl) or coordinates,
 *   - or click the spot on a map.
 *
 * Each one pins the stop, which is what puts it on the journey's route map.
 * Typing a new address unpins it until one of the above happens again; an
 * address still unpinned at save time is looked up by the editor.
 */
export function AddressField({ id, label, location, onChange }: AddressFieldProps) {
  const listId = useId()
  const address = location.address ?? ''
  const [query, setQuery] = useState<string | null>(null)
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  // Suggestions for typed addresses (links and coordinates are resolved instead).
  useEffect(() => {
    const q = query?.trim() ?? ''
    if (!canSearchPlaces || q.length < 3 || looksLikeLinkOrCoordinates(q)) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then((places) => setResults(places))
        .catch(() => undefined)
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const open = query !== null && query.trim().length >= 3 && results.length > 0 && !looksLikeLinkOrCoordinates(query)
  const pinned = isPinned(location)

  function apply(place: ResolvedPlace) {
    onChange({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      // Fill the name from the place when the author has not written one.
      ...(!location.name.trim() && place.name ? { name: place.name } : {}),
    })
    setError(null)
    setQuery(null)
    setResults([])
  }

  async function resolve(text: string) {
    setBusy(true)
    setError(null)
    try {
      apply(await resolveLinkOrCoordinates(text))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function pickSuggestion(place: Place) {
    apply({ lat: place.lat, lng: place.lng, address: [place.name, place.address].filter(Boolean).join(', '), name: place.name })
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={id}
            value={address}
            aria-label={label}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Gõ địa chỉ, hoặc dán link Google Maps / toạ độ"
            className="pl-9 pr-9"
            onChange={(e) => {
              const text = e.target.value
              // A new address no longer matches the old pin.
              onChange({ address: text, ...UNPINNED })
              setQuery(text)
              setError(null)
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (looksLikeLinkOrCoordinates(text)) {
                e.preventDefault()
                onChange({ address: text.trim() })
                void resolve(text)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery(null)
              if (e.key !== 'Enter') return
              e.preventDefault()
              if (looksLikeLinkOrCoordinates(address)) void resolve(address)
              else if (open) pickSuggestion(results[0])
            }}
            onBlur={() => window.setTimeout(() => setQuery(null), 150)}
          />
          {busy && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>

        {open && (
          <ul id={listId} role="listbox" className="np-overlay absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl p-1">
            {results.map((place, i) => (
              <li key={`${place.lng},${place.lat},${i}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  // mousedown, not click: the input's blur would close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickSuggestion(place)
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          <MapIcon />
          Chọn trên bản đồ
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <a href={googleMapsSearchUrl(address || location.name)} target="_blank" rel="noreferrer">
            <ExternalLink />
            Mở Google Maps
          </a>
        </Button>
      </div>

      {pinned ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-np-sage">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          Đã ghim trên bản đồ · {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ·
          <a href={googleMapsUrl(location.lat, location.lng)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-np-cream">
            Xem trên Google Maps
          </a>
        </p>
      ) : (
        <p className={cn('flex items-start gap-1.5 text-xs', address.trim() ? 'text-[hsl(var(--np-ochre))]' : 'text-muted-foreground')}>
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {address.trim()
            ? 'Chưa ghim. Chọn một gợi ý, dán link Google Maps, hoặc chọn trên bản đồ. Nếu không, khi lưu ChillnGo sẽ tự tìm theo địa chỉ.'
            : 'Trên Google Maps: mở địa điểm → Chia sẻ → Sao chép đường liên kết, rồi dán vào đây.'}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <MapPickerDialog
        open={picking}
        onOpenChange={setPicking}
        initial={pinned ? { lat: location.lat, lng: location.lng } : null}
        onPick={(place) => {
          apply(place)
          setPicking(false)
        }}
      />
    </div>
  )
}
