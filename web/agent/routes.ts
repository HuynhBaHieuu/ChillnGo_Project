/**
 * Every path the single-page app renders a real page for, in react-router
 * syntax. It mirrors src/app/router.tsx (routes.test.ts fails when the two
 * drift apart). Anything else is a 404: middleware.ts answers it with a real
 * 404 status instead of the app shell's 200.
 *
 * `:name` is one path segment, `:name?` an optional one, and a trailing `*`
 * any rest of the path, including none.
 */
export const APP_ROUTES = [
  '/',
  '/feed',
  '/discover',
  '/discover/interest/:tag',
  '/posts/new',
  '/posts/:id',
  '/posts/:id/edit',
  '/activity/:section?',
  '/itineraries',
  '/itineraries/:id',
  '/ai-drafts/:id',
  '/users/:id',
  '/live',
  '/live/:id',
  '/profile/edit',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  // The admin console sends any path under it to its index page.
  '/admin/*',
] as const

function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function matches(pattern: string, path: string[]): boolean {
  const parts = segments(pattern)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '*') return true
    const segment = path[i]
    if (part.startsWith(':') && part.endsWith('?')) {
      // Optional: matches this segment if there is one, or the end of the path.
      if (segment === undefined) return i === parts.length - 1
      continue
    }
    if (segment === undefined) return false
    if (part.startsWith(':')) continue
    if (part !== segment) return false
  }
  return path.length === parts.length
}

/** Whether the app has a page at `pathname` (already URL-decoded or not: ids are ASCII). */
export function isAppRoute(pathname: string): boolean {
  const path = segments(pathname)
  return APP_ROUTES.some((pattern) => matches(pattern, path))
}
