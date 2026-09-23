/**
 * Navbar theme for the home page.
 *
 * Written straight to <html data-nav-theme> (read by styles/home.css) rather
 * than through React state, because it is updated from ScrollTrigger callbacks
 * on every scroll frame — a re-render per frame would be far too expensive. The
 * write is skipped when the value has not changed.
 */

export type NavTheme = 'dark' | 'light'

let current: NavTheme | null = null

export function setNavTheme(theme: NavTheme) {
  if (theme === current) return
  current = theme
  document.documentElement.dataset.navTheme = theme
}

export function clearNavTheme() {
  current = null
  delete document.documentElement.dataset.navTheme
}
