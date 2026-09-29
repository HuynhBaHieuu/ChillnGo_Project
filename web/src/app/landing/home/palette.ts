/**
 * Design tokens read at run time, for the places a Tailwind class cannot reach.
 *
 * GSAP has to parse every colour it tweens and cannot resolve
 * `hsl(var(--foreground))` — but it does read the numbers out of
 * `hsl(258 69% 14%)` whatever separates them. So the token is looked up on
 * <html> and wrapped, which keeps the stage timelines in step with the palette
 * instead of pinning hexes that go stale the next time the theme changes.
 *
 * The fallbacks are the Arcade Neon Pop values, used only if the stylesheet has
 * not applied yet.
 */

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

/** The page ground. */
export const groundColor = () => token('--background', '#fff0f6')

/** Body ink — the deep purple everything readable is set in. */
export const inkColor = () => token('--foreground', '#1a0b3c')

/**
 * The display face's family name, for text drawn on a canvas. Only the first
 * family: a canvas silently keeps its 10px sans-serif default when it cannot
 * parse a `font` string, so the fewer names in it, the less can go wrong.
 */
export const displayFontFamily = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--font-display').split(',')[0].trim() ||
  'sans-serif'

/** Muted ink, for type that has not lit up yet. */
export const mutedInkColor = () => token('--secondary-ink', '#6a5c8a')
