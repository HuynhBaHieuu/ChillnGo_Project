import { cn } from '@/lib/utils'

interface TagChipProps {
  tag: string
  /** Renders as a button and reports clicks — used by the Discover filters. */
  onClick?: () => void
  active?: boolean
  className?: string
}

/** A single trip tag. Read-only by default; interactive when `onClick` is given. */
export function TagChip({ tag, onClick, active = false, className }: TagChipProps) {
  const base = cn(
    'inline-flex items-center rounded-full px-3 py-1 text-xs transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-border text-muted-foreground',
    className,
  )

  if (!onClick) {
    return <span className={base}>{tag}</span>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(base, !active && 'hover:border-white/40 hover:text-foreground')}
    >
      {tag}
    </button>
  )
}

interface TagChipListProps {
  tags: string[]
  /** Show at most this many, then a "+N" chip. */
  max?: number
  className?: string
}

export function TagChipList({ tags, max, className }: TagChipListProps) {
  const shown = max ? tags.slice(0, max) : tags
  const hidden = tags.length - shown.length

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((tag) => (
        <TagChip key={tag} tag={tag} />
      ))}
      {hidden > 0 && <TagChip tag={`+${hidden}`} />}
    </div>
  )
}
