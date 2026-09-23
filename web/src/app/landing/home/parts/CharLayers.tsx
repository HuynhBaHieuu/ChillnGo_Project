import { cn } from '@/lib/utils'

interface CharLayersProps {
  text: string
  as?: 'p' | 'h2' | 'span'
  className?: string
}

/**
 * Text that "lights up" character by character as you scroll.
 *
 * Two copies of the same text sit on top of each other:
 * - `[data-dim]` — a faint ghost of the whole line, always visible behind, so
 *   the sentence has a shape before it is readable;
 * - `[data-chars]` — the real, readable copy; the stage splits it into
 *   characters with SplitText and fades each one in over the ghost.
 *
 * With reduced motion the ghost is hidden and the readable copy simply shows.
 */
export function CharLayers({ text, as: Tag = 'p', className }: CharLayersProps) {
  return (
    <Tag className={cn('relative', className)}>
      <span
        aria-hidden
        data-dim
        className="absolute inset-0 block text-foreground/20 motion-reduce:hidden"
      >
        {text}
      </span>
      <span data-chars className="relative block">
        {text}
      </span>
    </Tag>
  )
}
