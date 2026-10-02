import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

type PhotoTileProps = {
  label: string
  image: string
  className?: string
} & (
  | { to: string; onClick?: never; active?: never }
  | { to?: never; onClick: () => void; active?: boolean }
)

/**
 * A square photo with its label set large over a dark band at the bottom.
 * Either a link (`to`) or a toggle (`onClick` + `active`).
 *
 * On hover the whole tile fades to 80% and the label underlines — no zoom.
 */
export function PhotoTile({ label, image, className, ...action }: PhotoTileProps) {
  const classes = cn(
    'np-media group relative block aspect-square w-full overflow-hidden rounded-xl text-left',
    'transition-opacity duration-100 ease-linear hover:opacity-80',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    action.active && 'ring-2 ring-primary',
    className,
  )

  const body = (
    <>
      <img
        src={image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full rounded-[inherit] object-cover object-center"
      />
      {/* A solid band behind the label that fades out over its top 32px. */}
      <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.6)_0,rgba(0,0,0,0.6)_calc(100%-32px),rgba(0,0,0,0)_100%)] px-4 pb-4 pt-10 md:px-5 md:pb-5">
        <span className="block font-display text-2xl font-bold leading-tight text-white decoration-2 underline-offset-4 first-letter:uppercase group-hover:underline md:text-3xl">
          {label}
        </span>
      </span>
    </>
  )

  if (action.to !== undefined) {
    return (
      <Link to={action.to} className={classes}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={action.onClick} aria-pressed={action.active} className={classes}>
      {body}
    </button>
  )
}
