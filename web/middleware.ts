/**
 * Vercel Routing Middleware: runs before the static files and the rewrites in
 * vercel.json, for every path except the API proxy and the built assets.
 *
 * - `Accept: text/markdown` gets the page's Markdown version, with
 *   `Vary: Accept`. Browsers never send that, so they keep the HTML app.
 * - A path the site has no page for gets a real 404 status: Markdown for
 *   agents that asked for it, otherwise the usual app shell, which renders the
 *   app's own "not found" page as before.
 * - Everything else continues unchanged via `next()`.
 *
 * Deliberately one self-contained file whose only import is @vercel/functions:
 * how Vercel compiles middleware must not decide whether the site loads. Any
 * unexpected error also falls back to `next()`, so a bug here degrades to the
 * site as it was, never to a 500 on every page.
 */

import { next } from '@vercel/functions'

export const config = {
  // Not the API proxy or the built assets. Files elsewhere are skipped below.
  matcher: ['/((?!api/|assets/).*)'],
}

/* ------------------------------------------------------------------ pages */

/**
 * Every path the single-page app renders a real page for, in react-router
 * syntax. It mirrors src/app/router.tsx (tests/routes.test.ts fails when the
 * two drift apart). `:name` is one path segment, `:name?` an optional one, and
 * a trailing `*` any rest of the path, including none.
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

/**
 * Plain HTML pages outside the app, in public/ and mapped to these paths by
 * rewrites in vercel.json.
 */
export const STATIC_PAGES = ['/developers', '/developers/cli'] as const

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

/** Whether the site has a page at `pathname`. */
export function isKnownPage(pathname: string): boolean {
  const path = segments(pathname)
  return [...APP_ROUTES, ...STATIC_PAGES].some((pattern) => matches(pattern, path))
}

/** Paths that name a file (favicon.svg, llms.txt), well-known metadata or the API: never pages. */
function isFileOrApi(pathname: string): boolean {
  return (
    /\.[^/]+$/.test(pathname) ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/.well-known/')
  )
}

/* ------------------------------------------------------------ negotiation */

interface MediaRange {
  type: string
  q: number
}

function parseAccept(header: string): MediaRange[] {
  return header
    .split(',')
    .map((part) => {
      const [type, ...params] = part.split(';').map((s) => s.trim().toLowerCase())
      const qParam = params.find((p) => p.startsWith('q='))
      const q = qParam ? Number(qParam.slice(2)) : 1
      return { type, q: Number.isFinite(q) ? Math.min(Math.max(q, 0), 1) : 0 }
    })
    .filter((range) => range.type.length > 0)
}

/** The q-value the header gives `type`, from its most specific matching range (RFC 9110 §12.5.1). */
function qualityOf(ranges: MediaRange[], type: string): number {
  const [major] = type.split('/')
  for (const candidate of [type, `${major}/*`, '*/*']) {
    const found = ranges.filter((r) => r.type === candidate)
    if (found.length > 0) return Math.max(...found.map((r) => r.q))
  }
  return 0
}

/**
 * Whether the client asked for Markdown rather than HTML. Only an explicit
 * `text/markdown` range counts: browsers send `text/html…, *\/*`, which never
 * selects Markdown. When both are equally acceptable, Markdown wins, because
 * naming it at all is a deliberate choice no browser makes.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false
  const ranges = parseAccept(accept)
  const markdown = Math.max(0, ...ranges.filter((r) => r.type === 'text/markdown').map((r) => r.q))
  if (markdown === 0) return false
  const html = Math.max(qualityOf(ranges, 'text/html'), qualityOf(ranges, 'application/xhtml+xml'))
  return markdown >= html
}

/* --------------------------------------------------------------- Markdown */

const GITHUB_URL = 'https://github.com/HuynhBaHieuu/ChillnGo_Project'

const links = (origin: string) => `## Liên kết

- [Khám phá hành trình](${origin}/discover): lọc theo vùng, mùa và ngân sách.
- [Bảng tin](${origin}/feed): hành trình và check-in mới nhất.
- [Đang phát trực tiếp](${origin}/live): livestream từ những người đang trên đường.
- [Đăng ký](${origin}/register) · [Đăng nhập](${origin}/login)

## Dành cho agent và nhà phát triển

- [ChillnGo API — Developer Portal](${origin}/developers): tài liệu API, quickstart, xác thực.
- [ChillnGo CLI](${origin}/developers/cli): công cụ dòng lệnh \`chillngo\`.
- [OpenAPI](${origin}/openapi.json): mô tả đầy đủ API JSON tại \`${origin}/api\`.
- [llms.txt](${origin}/llms.txt): tóm tắt trang web cho mô hình ngôn ngữ.
- [GitHub](${GITHUB_URL}): mã nguồn.
`

const developerLinks = (origin: string) => `## Resources

- [OpenAPI 3.1 description](${origin}/openapi.json)
- [API index](${origin}/api)
- [ChillnGo CLI](${origin}/developers/cli)
- [llms.txt](${origin}/llms.txt)
- [Source code on GitHub](${GITHUB_URL})
`

type Page = (origin: string) => string

const PAGES: Record<string, Page> = {
  '/': (origin) => `# ChillnGo — Mạng xã hội du lịch của những chuyến đi có thật

> Những chuyến đi có thật, kể lại bởi chính người đã đi.

ChillnGo là mạng xã hội du lịch để chia sẻ hành trình có thật, kể lại trọn vẹn — từng ngày, từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Sao chép lịch trình du lịch đó về làm của bạn chỉ với một chạm, rồi sửa theo cách bạn muốn đi.

Lịch trình hay nhất không nằm trong cẩm nang, mà nằm trong chuyến đi của ai đó vừa trở về. Lên kế hoạch mất ba tuần. Sao chép một chuyến đi có thật chỉ mất một chạm.

## Cách ChillnGo hoạt động

### 1. Khám phá hành trình thật

- Lọc theo vùng, mùa và ngân sách để ra đúng kiểu chuyến bạn muốn.
- Xem từng ngày: mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.

### 2. Sao chép về và sửa theo ý bạn

- Sao chép một chạm biến chuyến đi của người khác thành bản nháp của bạn.
- Kéo thả để đổi thứ tự ngày, ngày tháng tự cập nhật theo.
- Ghép nhiều chuyến: lấy những ngày hay nhất từ nhiều bài.

### 3. Đi xong, chia sẻ lại

- Đăng hành trình của bạn cho người đi sau tham khảo và sao chép tiếp.

${links(origin)}`,

  '/discover': (origin) => `# Khám phá hành trình — ChillnGo

Những hành trình nhiều ngày do chính người đã đi đăng lại: từng ngày, từng điểm dừng có toạ độ, ghi chú, ảnh và chi phí. Lọc theo vùng, mùa và ngân sách để ra đúng kiểu chuyến bạn muốn, rồi sao chép về làm lịch trình của bạn.

Danh sách được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/posts\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,

  '/feed': (origin) => `# Bảng tin — ChillnGo

Hành trình và check-in mới nhất từ cộng đồng ChillnGo, và từ những người bạn theo dõi khi đã đăng nhập.

Bảng tin được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/posts\` và \`GET ${origin}/api/checkins\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,

  '/live': (origin) => `# Đang phát trực tiếp — ChillnGo

Livestream từ những người đang trên đường, và các buổi phát đã ghi lại để xem lại.

Danh sách được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/livestreams\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,

  '/developers': (origin) => `# ChillnGo API — Developer Portal

The ChillnGo API is a public JSON REST API for ChillnGo, a Vietnamese travel social network of real multi-day trip journeys. Read published journeys, check-ins, livestreams and profiles without an account; sign in to create journeys and clone itineraries.

Base URL: \`${origin}/api\`

## Quickstart

\`\`\`sh
# Published journeys, newest first (no sign-in needed)
curl ${origin}/api/posts

# One journey, day by day and stop by stop
curl ${origin}/api/posts/{id}

# The full OpenAPI 3.1 description
curl ${origin}/openapi.json
\`\`\`

Or use the CLI: \`npx chillngo posts\`.

## Authentication

There are no separate API keys. Reading public data needs no credentials. To act as a user, sign in and send the returned token:

\`\`\`sh
curl -X POST ${origin}/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"…"}'
# → { "token": "…", "user": { … } }

curl ${origin}/api/auth/me -H 'Authorization: Bearer <token>'
\`\`\`

## Errors

Every error is JSON: \`{ "message", "code", "status", "hint", "docs" }\`. \`message\` is Vietnamese text for people; \`code\` is a stable identifier such as \`NOT_FOUND\`, \`VALIDATION_FAILED\` or \`RATE_LIMITED\`; \`hint\` says what to do next. Validation errors add \`issues\`, one per field.

## Rate limits

Write and sign-in routes are rate-limited per account or IP. A limited request gets \`429 RATE_LIMITED\` with \`RateLimit\` and \`RateLimit-Policy\` headers (IETF draft 8); wait as they say, then retry.

## Sandbox

There is no separate sandbox. The public read endpoints are safe to call against production; use a test account for anything that writes.

${developerLinks(origin)}`,

  '/developers/cli': (origin) => `# ChillnGo CLI

\`chillngo\` is the official command-line tool for the ChillnGo API: read journeys, check-ins and livestreams, sign in, and call any endpoint from a terminal or a script.

## Install

\`\`\`sh
npm install -g chillngo     # or run without installing: npx chillngo
\`\`\`

Needs Node.js 18.3 or newer.

## Commands

\`\`\`sh
chillngo posts [--author <userId>]   # published journeys
chillngo post <id>                   # one journey, day by day
chillngo checkins [--authors <ids>]  # recent check-ins
chillngo live                        # streams live now
chillngo user <id>                   # a public profile
chillngo login --email <email>       # sign in (password from CHILLNGO_PASSWORD or a prompt)
chillngo me                          # the signed-in account
chillngo logout
chillngo api <METHOD> <path> [--data <json>]   # any endpoint
chillngo openapi                     # print the OpenAPI description
\`\`\`

Add \`--json\` to any command for raw JSON. \`--base-url\` or \`CHILLNGO_API_URL\` points it at another server; \`CHILLNGO_TOKEN\` supplies a token without signing in.

${developerLinks(origin)}`,
}

/** The Markdown version of the page at `pathname`, or null when it has none. */
export function pageMarkdown(pathname: string, origin: string): string | null {
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGES[key]?.(origin) ?? null
}

/** The body of a 404, for agents: what happened and where to look instead. */
export function notFoundMarkdown(pathname: string, origin: string): string {
  return `# 404 — Page not found

There is no page at \`${pathname}\` on ChillnGo. Check the address, or start from one of these:

- [Home page](${origin}/): what ChillnGo is.
- [Developer Portal](${origin}/developers): the ChillnGo API docs.
- [llms.txt](${origin}/llms.txt): a map of the site for language models.
- [OpenAPI description](${origin}/openapi.json): the JSON API at \`${origin}/api\`.

Không tìm thấy trang \`${pathname}\` trên ChillnGo.
`
}

/* ------------------------------------------------------------- responses */

const CACHE = 'public, max-age=0, must-revalidate'

function markdownResponse(body: string, status: number, method: string): Response {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept', 'Cache-Control': CACHE },
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

async function handle(request: Request): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null

  const url = new URL(request.url)
  if (isFileOrApi(url.pathname)) return null
  const known = isKnownPage(url.pathname)

  if (prefersMarkdown(request.headers.get('accept'))) {
    if (!known) return markdownResponse(notFoundMarkdown(url.pathname, url.origin), 404, request.method)
    const markdown = pageMarkdown(url.pathname, url.origin)
    if (markdown) return markdownResponse(markdown, 200, request.method)
    // A real page without a Markdown version (sign-in only pages): the HTML app.
  }

  if (!known) return htmlNotFound(url, request.method)
  return null
}

export default async function middleware(request: Request): Promise<Response> {
  try {
    return (await handle(request)) ?? next()
  } catch (error) {
    console.error('middleware failed; serving the request unchanged', error)
    return next()
  }
}
