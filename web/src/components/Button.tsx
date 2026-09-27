import { Slot } from '@radix-ui/react-slot'
import { Children, cloneElement, isValidElement } from 'react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

interface GlassButtonProps extends React.ComponentProps<'button'> {
  /** Render the child element instead of a `<button>` — for `<Link>` CTAs. */
  asChild?: boolean
  size?: 'sm' | 'md' | 'lg' | 'hero'
  tone?: 'glass' | 'sunset'
}

const SIZES: Record<NonNullable<GlassButtonProps['size']>, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-sm',
  /** The landing-page CTA proportions. */
  hero: 'px-14 py-5 text-base',
}

const TONES: Record<NonNullable<GlassButtonProps['tone']>, string> = {
  glass: 'liquid-glass liquid-glass-interactive text-foreground',
  /**
   * The palette's 10%. Solid sunset carries the one action a screen is really
   * asking for; `sunset-foreground` is the darkened forest ink, because white
   * on sunset is only 3:1 and would fail AA.
   */
  sunset: [
    'bg-sunset text-sunset-foreground shadow-lg shadow-forest-ink/30',
    'transition-colors duration-200 hover:bg-sunset/90',
  ].join(' '),
}

/**
 * The app's primary call to action.
 *
 * Every primary CTA in ChillnGo is a pill — landing hero, "Dùng làm lịch trình
 * của tôi", Follow, form submits. Over photography it is glass; where it is the
 * single thing to do on the screen it is `tone="sunset"`. Secondary actions use
 * the shadcn `Button` from `@/components/ui/button` instead.
 */
/**
 * Label wrapper. `.liquid-glass` draws its rim in a `::before` at z-index 0, so
 * the words need a positioned box above it or the rim crosses them.
 */
function Label({ children }: { children: React.ReactNode }) {
  return <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
}

export function GlassButton({
  asChild = false,
  size = 'md',
  tone = 'glass',
  className,
  children,
  ...props
}: GlassButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-medium disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    TONES[tone],
    SIZES[size],
    className,
  )

  if (!asChild) {
    return (
      <button data-tone={tone} className={classes} {...props}>
        <Label>{children}</Label>
      </button>
    )
  }

  /*
   * `Slot` merges props onto its immediate child, so passing it `<Label>` would
   * hand the pill's padding to a span and leave the caller's `<Link>` inline
   * inside it — a 231×64 button with a 119×24 hit area, all of the padding
   * dead. The label has to go *inside* the caller's element instead.
   */
  const child = Children.only(children)
  if (!isValidElement<{ children?: React.ReactNode }>(child)) {
    return (
      <Slot data-tone={tone} className={classes} {...props}>
        {child}
      </Slot>
    )
  }

  return (
    <Slot data-tone={tone} className={classes} {...props}>
      {cloneElement(child, undefined, <Label>{child.props.children}</Label>)}
    </Slot>
  )
}
