/**
 * The photo wheel revealed by the destinations stage.
 *
 * Photos hang on "arms" — zero-size elements at the wheel's centre, each rotated
 * by its angle. A zero-size box rotates about its own position, so every arm
 * pivots around the wheel centre and the photo at its tip stays tangent to the
 * rim. The stage then rotates `[data-wheel]` as a whole.
 *
 * The wheel's centre sits below the viewport (135vh down on desktop, radius
 * 59vw) so only the top of the rim shows, with photos rising in from the left
 * and sinking out to the right.
 */
export function MomentsRing({ photos }: { photos: string[] }) {
  return (
    <div
      data-ring
      className="absolute inset-0 [--ring-r:90vw] [--ring-y:112%] md:[--ring-r:59vw] md:[--ring-y:135%]"
    >
      <div data-wheel className="absolute left-1/2 top-[var(--ring-y)] size-0">
        {photos.map((src, i) => (
          <div
            key={`${i}-${src}`}
            className="absolute left-0 top-0 size-0"
            style={{ transform: `rotate(${(i * 360) / photos.length}deg)` }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute left-0 top-[calc(var(--ring-r)*-1)] h-[max(14vw,178px)] w-[max(11vw,140px)] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
            />
          </div>
        ))}
      </div>

      {/* Progress arc: the top 140° of a circle at 0.42× the wheel radius. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute left-1/2 top-[var(--ring-y)] size-[76vw] -translate-x-1/2 -translate-y-1/2 overflow-visible md:size-[50vw]"
      >
        <path
          data-arc
          d="M 3.96 33.24 A 49 49 0 0 1 96.04 33.24"
          fill="none"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1}
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-foreground/40"
        />
      </svg>
    </div>
  )
}
