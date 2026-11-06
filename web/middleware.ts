/**
 * Vercel Routing Middleware: runs before the static files and the rewrites in
 * vercel.json, for page paths only (see `config.matcher`).
 *
 * - `Accept: text/markdown` gets the page's Markdown version (agent/content.ts)
 *   with `Vary: Accept`. Browsers never send that, so they keep the HTML app.
 * - A path the app has no page for (agent/routes.ts) gets a real 404 status:
 *   Markdown for agents that asked for it, otherwise the usual app shell,
 *   which renders the app's own "not found" page as before.
 * - Everything else passes through untouched (no return value).
 */

import { prefersMarkdown } from './agent/accept.ts'
import { notFoundMarkdown, pageMarkdown } from './agent/content.ts'
import { isAppRoute } from './agent/routes.ts'

export const config = {
  // Not the API proxy or the built assets. Files elsewhere are skipped below.
  matcher: ['/((?!api/|assets/).*)'],
}

/** Paths that name a file (favicon.svg, llms.txt, openapi.json) or the API: never pages. */
function isFileOrApi(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname) || pathname === '/api' || pathname.startsWith('/api/')
}

const CACHE = 'public, max-age=0, must-revalidate'

function markdownResponse(body: string, status: number, method: string): Response {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': CACHE,
    },
  })
}

const FALLBACK_404_HTML = `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8"><title>404 — ChillnGo</title></head>
<body><h1>404 — Không tìm thấy trang</h1><p>Trang bạn tìm không tồn tại. <a href="/">Về trang chủ ChillnGo</a>.</p></body></html>`

/** The app shell with a 404 status: the app's router then shows its "not found" page. */
async function htmlNotFound(url: URL, method: string): Promise<Response> {
  let body: ReadableStream<Uint8Array> | string | null = FALLBACK_404_HTML
  try {
    const shell = await fetch(new URL('/index.html', url))
    if (shell.ok) body = shell.body
  } catch {
    // Keep the plain fallback page.
  }
  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept', 'Cache-Control': CACHE },
  })
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined

  const url = new URL(request.url)
  if (isFileOrApi(url.pathname)) return undefined
  const known = isAppRoute(url.pathname)

  if (prefersMarkdown(request.headers.get('accept'))) {
    if (!known) return markdownResponse(notFoundMarkdown(url.pathname, url.origin), 404, request.method)
    const markdown = pageMarkdown(url.pathname, url.origin)
    if (markdown) return markdownResponse(markdown, 200, request.method)
    // A real page without a Markdown version (sign-in only pages): the HTML app.
  }

  if (!known) return htmlNotFound(url, request.method)
  return undefined
}
