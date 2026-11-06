/**
 * Content negotiation between the HTML app and its Markdown version
 * (RFC 9110 §12.5.1 Accept, with q-values).
 */

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

/** The q-value the header gives `type`, from its most specific matching range. */
function qualityOf(ranges: MediaRange[], type: string): number {
  const [major] = type.split('/')
  const exact = ranges.filter((r) => r.type === type)
  if (exact.length > 0) return Math.max(...exact.map((r) => r.q))
  const sub = ranges.filter((r) => r.type === `${major}/*`)
  if (sub.length > 0) return Math.max(...sub.map((r) => r.q))
  const any = ranges.filter((r) => r.type === '*/*')
  if (any.length > 0) return Math.max(...any.map((r) => r.q))
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
