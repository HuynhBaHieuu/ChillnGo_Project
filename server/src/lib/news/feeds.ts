/**
 * Reading news feeds: RSS 2.0, Atom (YouTube channels) and Google News search,
 * plus the rules every item goes through (canonical link, plain text,
 * keyword filter). Parsing is kept free of the network so it can be tested.
 */

import { XMLParser } from 'fast-xml-parser'

/** One item as a source gives it, before it is stored. */
export interface RawNewsItem {
  url: string
  title: string
  excerpt: string
  imageUrl: string
  publishedAt: Date
  author: string
  kind: 'article' | 'video' | 'post'
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  // Never expand entities beyond the standard ones (billion-laughs safe).
  processEntities: true,
  htmlEntities: true,
})

type Node = Record<string, unknown>

const asArray = <T>(value: T | T[] | undefined | null): T[] => (value == null ? [] : Array.isArray(value) ? value : [value])

function textOf(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && '#text' in (value as Node)) return String((value as Node)['#text'] ?? '')
  return ''
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** HTML to one line of plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : m
      }
      return ENTITIES[code.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$)/i

/** The link as stored: https, no tracking parameters, no fragment, no trailing slash. Null when not a web link. */
export function canonicalUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key)
  url.hostname = url.hostname.toLowerCase().replace(/^m\./, '').replace(/^www\./, '')
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/^http:/, 'https:')
}

/**
 * A picture link as stored: absolute and https, or '' when it cannot be one.
 * Repairs the two shapes feeds get wrong: "//host/path" (no scheme) and
 * "https://site///host/path" (a scheme-less link glued onto the site).
 */
export function imageLink(raw: string, base?: string): string {
  const value = raw.trim()
  if (!value || value.startsWith('data:')) return ''
  let url: URL
  try {
    url = new URL(value.startsWith('//') ? `https:${value}` : value, base)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  const glued = /^\/\/+([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/.*)$/i.exec(url.pathname)
  if (glued) {
    try {
      url = new URL(`https://${glued[1]}${glued[2]}${url.search}`)
    } catch {
      return ''
    }
  }
  url.hash = ''
  return url.toString().replace(/^http:/, 'https:')
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()

/**
 * The same story under another link (Google News wraps every article in its
 * own redirect): compared by title, ignoring accents, case, punctuation and a
 * trailing " - Publisher".
 */
export function titleKey(title: string): string {
  return fold(plainText(title))
    .replace(/\s+[-–|]\s+[^-–|]{2,60}$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * An excerpt that only repeats the title (Google News: "Title  Publisher")
 * says nothing: drop it, so the card shows the title alone or the AI summary.
 */
export function usefulExcerpt(title: string, excerpt: string): string {
  const text = plainText(excerpt)
  const key = titleKey(title)
  const rest = fold(text).replace(/[^a-z0-9]+/g, ' ').trim()
  if (key && rest.startsWith(key) && rest.length - key.length < 60) return ''
  return text
}

/** Include: at least one keyword when any are given. Exclude: none of them. Accents and case are ignored. */
export function passesKeywords(text: string, include: string[], exclude: string[]): boolean {
  const hay = fold(text)
  const has = (k: string) => k.trim() !== '' && hay.includes(fold(k.trim()))
  if (exclude.some(has)) return false
  const wanted = include.filter((k) => k.trim() !== '')
  return wanted.length === 0 || wanted.some(has)
}

function firstImage(html: string): string {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html)
  return match ? match[1] : ''
}

function date(value: string): Date {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/** RSS 2.0 or Atom → items. Unknown documents give none. */
export function parseFeed(xml: string): RawNewsItem[] {
  let doc: Node
  try {
    doc = parser.parse(xml) as Node
  } catch {
    return []
  }

  const rss = doc.rss as Node | undefined
  if (rss?.channel) {
    const channel = rss.channel as Node
    return asArray(channel.item as Node | Node[]).flatMap((item) => {
      const link = textOf(item.link) || textOf((item.guid as Node | string | undefined) ?? '')
      const url = canonicalUrl(link)
      const title = plainText(textOf(item.title))
      if (!url || !title) return []
      const html = textOf(item.description) || textOf(item['content:encoded'])
      const enclosure = asArray(item.enclosure as Node | Node[]).find((e) => String(e['@type'] ?? '').startsWith('image'))
      const media = asArray((item['media:content'] ?? item['media:thumbnail']) as Node | Node[])[0]
      const imageUrl = String(enclosure?.['@url'] ?? media?.['@url'] ?? '') || firstImage(html)
      return [{
        url,
        title,
        excerpt: truncate(plainText(html), 500),
        imageUrl: imageLink(imageUrl, url),
        publishedAt: date(textOf(item.pubDate) || textOf(item['dc:date'])),
        author: plainText(textOf(item['dc:creator']) || textOf(item.author) || textOf((item.source as Node)?.['#text'] ?? '')),
        kind: 'article' as const,
      }]
    })
  }

  const feed = doc.feed as Node | undefined
  if (feed) {
    const feedAuthor = textOf((feed.author as Node | undefined)?.name)
    return asArray(feed.entry as Node | Node[]).flatMap((entry) => {
      const links = asArray(entry.link as Node | Node[])
      const href = String((links.find((l) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0])?.['@href'] ?? '')
      const url = canonicalUrl(href)
      const title = plainText(textOf(entry.title))
      if (!url || !title) return []
      const group = entry['media:group'] as Node | undefined
      const videoId = textOf(entry['yt:videoId'])
      const thumb = String((group?.['media:thumbnail'] as Node | undefined)?.['@url'] ?? '')
      const html = textOf(group?.['media:description']) || textOf(entry.summary) || textOf(entry.content)
      return [{
        url,
        title,
        excerpt: truncate(plainText(html), 500),
        imageUrl: imageLink(thumb || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : firstImage(html)), url),
        publishedAt: date(textOf(entry.published) || textOf(entry.updated)),
        author: plainText(textOf((entry.author as Node | undefined)?.name) || feedAuthor),
        kind: videoId ? ('video' as const) : ('article' as const),
      }]
    })
  }
  return []
}

/** Google News search as RSS, in Vietnamese. */
export function googleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=vi&gl=VN&ceid=VN:vi`
}

/** The channel id in a YouTube link, when the link names it. */
export function youtubeChannelId(url: string): string | null {
  const match = /(?:channel_id=|\/channel\/)(UC[\w-]{22})/.exec(url)
  return match ? match[1] : null
}

export function youtubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

/** The channel id inside a channel page's HTML (for links like youtube.com/@name). */
export function channelIdInPage(html: string): string | null {
  const match = /"(?:externalId|channelId|browseId)":"(UC[\w-]{22})"/.exec(html) ?? /channel_id=(UC[\w-]{22})/.exec(html)
  return match ? match[1] : null
}
