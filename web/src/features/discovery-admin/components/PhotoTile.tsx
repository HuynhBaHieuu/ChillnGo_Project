import { cn } from '@/lib/utils'

interface PhotoTileProps {
  label: string
  image: string
  active?: boolean
  onClick: () => void
  className?: string
}

/** A square photo with its label set large in the bottom-left corner. */
export function PhotoTile({ label, image, active = false, onClick, className }: PhotoTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'np-media group relative block aspect-square w-full overflow-hidden rounded-xl text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'ring-2 ring-primary',
        className,
      )}
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full rounded-[inherit] object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/70" />
      <span className="absolute inset-x-0 bottom-0 p-4 font-display text-2xl font-bold leading-tight text-white first-letter:uppercase md:p-6 md:text-4xl">
        {label}
      </span>
    </button>
  )
}
