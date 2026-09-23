import { useMemo } from 'react'

import { cn } from '@/lib/utils'

/**
 * Shown when there is no Mapbox token, or while the map chunk loads.
 *
 * It is not a map — it is an honest sketch of the same coordinates, so the
 * shape and order of the route still read and the page layout holds without a
 * Mapbox account.
 */
export function StaticRouteFallback({
  coords,
  className,
  label,
  reason = 'no-token',
}: {
  coords: [number, number][]
  className?: string
  label: string
  reason?: 'no-token' | 'loading'
}) {
  const points = useMemo(() => {
    if (coords.length === 0) return []

    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)

    const spanLng = maxLng - minLng || 1
    const spanLat = maxLat - minLat || 1

    // 8% inset so markers near the edge are not clipped.
    return coords.map(([lng, lat]) => ({
      x: 8 + ((lng - minLng) / spanLng) * 84,
      y: 92 - ((lat - minLat) / spanLat) * 84,
    }))
  }, [coords])

  return (
    <div
      className={cn('relative overflow-hidden border border-border bg-card', className)}
      role="img"
      aria-label={label}
    >
      <div className="relative z-[1] flex size-full flex-col">
        {points.length > 0 ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="size-full flex-1"
            aria-hidden
          >
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.9} fill="#ffffff" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Chưa có dữ liệu bản đồ
          </div>
        )}

        <p className="px-4 pb-3 text-center text-xs text-muted-foreground">
          {reason === 'loading' ? (
            'Đang tải bản đồ…'
          ) : (
            <>
              Bản đồ tương tác cần <code className="text-foreground">VITE_MAPBOX_TOKEN</code>.
              Đây là bản phác thảo tuyến đường từ dữ liệu mock.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
