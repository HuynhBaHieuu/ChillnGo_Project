/**
 * Reading the original article of a news item: its main text (for the AI to
 * write the ChillnGo post from; never stored) and its pictures (stored as
 * links). `extractArticle` works on HTML alone so it can be tested; only
 * `fetchArticle` touches the network.
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import { imageLink, plainText } from './feeds.js'

/** Pictures kept for one news item, the cover first. */
export const MAX_IMAGES = 12
/** Characters of the original text handed to the AI. */
export const MAX_ARTICLE_CHARS = 7000

const USER_AGENT = 'ChillnGoNewsBot/1.0 (+https://chillgo-project-web.vercel.app)'
const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 2 * 1024 * 1024

const NOT_A_PHOTO = /(sprite|icon|logo|avatar|emoji|pixel|blank|spacer|placeholder|loading|lazy|1x1|gravatar|badge|share|button|banner|\/ads?\/)/i

/** Decorations, trackers and animations are not pictures of the story. */
export function looksLikePhoto(url: string): boolean {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  if (/\.(svg|gif|ico)$/i.test(path)) return false
  // Thumbnails say their size in the link (…/zoom/80_80/…, …-150x150.jpg).
  const size = /[/_-](\d{2,4})[x_](\d{2,4})(?=[/.])/.exec(path)
  if (size && Number(size[1]) < 400 && Number(size[2]) < 300) return false
  return !NOT_A_PHOTO.test(path)
}

/** The same picture at another size or with another query counts once. */
const imageKey = (url: string) => {
  const u = new URL(url)
  return (u.hostname + u.pathname).toLowerCase().replace(/[-_]\d{2,4}x\d{2,4}(?=\.\w+$)/, '')
}

/** Usable pictures in order, each once, at most `limit`. */
export function pickImages(candidates: string[], limit = MAX_IMAGES): string[] {
  const seen = new Set<string>()
  const picked: string[] = []
  for (const candidate of candidates) {
    if (!candidate || !looksLikePhoto(candidate)) continue
    const key = imageKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(candidate)
    if (picked.length === limit) break
  }
  return picked
}

const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined) ?? ''

/** The largest candidate of a srcset ("a.jpg 480w, b.jpg 1200w"). */
function fromSrcset(srcset: string): string {
  const entries = srcset
    .split(/,\s+/)
    .map((entry) => {
      const [url, size] = entry.trim().split(/\s+/)
      return { url, size: parseFloat(size ?? '') || 0 }
    })
    .filter((e) => e.url)
  return entries.sort((a, b) => b.size - a.size)[0]?.url ?? ''
}

/** Picture links inside a piece of HTML, in order; lazy-loading attributes are understood. */
export function imagesInHtml(html: string, base?: string): string[] {
  const found: string[] = []
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    const width = Number(attr(tag, 'width'))
    const height = Number(attr(tag, 'height'))
    if ((width > 0 && width < 200) || (height > 0 && height < 120)) continue
    const lazy = attr(tag, 'data-src') || attr(tag, 'data-original') || attr(tag, 'data-lazy-src') || fromSrcset(attr(tag, 'data-srcset'))
    const link = imageLink(lazy || attr(tag, 'src') || fromSrcset(attr(tag, 'srcset')), base)
    if (link) found.push(link)
  }
  return found
}

export interface Article {
  /** Main text, plain, at most MAX_ARTICLE_CHARS. '' when the page gave none. */
  text: string
  /** Cover first, then the pictures of the article body. */
  images: string[]
}

/** The article in a page's HTML. Never throws: an unreadable page gives no text and no pictures. */
export function extractArticle(html: string, pageUrl: string): Article {
  try {
    const { document } = parseHTML(html)
    const meta = (selector: string) => document.querySelector(selector)?.getAttribute('content') ?? ''
    const cover = imageLink(meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]'), pageUrl)
    for (const chrome of document.querySelectorAll('nav, header, footer, aside, form, script, style, noscript')) chrome.remove()
    // Readability drops galleries and figures it finds too thin; then the page's own article element is searched instead.
    const body = document.querySelector('[itemprop="articleBody"], article, main')?.innerHTML ?? ''
    // Readability rewrites the document it is given; nothing else reads it afterwards.
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse()
    const text = plainText(article?.content ?? '')
    const inText = imagesInHtml(article?.content ?? '', pageUrl)
    // Interface pieces around an article are PNGs; its photographs are not.
    const inBody = inText.length < 3 ? imagesInHtml(body, pageUrl).filter((link) => !/\.png$/i.test(new URL(link).pathname)) : []
    return {
      text: text.length > MAX_ARTICLE_CHARS ? text.slice(0, MAX_ARTICLE_CHARS) : text,
      images: pickImages([cover, ...inText, ...inBody]),
    }
  } catch {
    return { text: '', images: [] }
  }
}

/** Pages worth opening: public web addresses, and not Google News' own redirect pages (they hold no article). */
export function readablePage(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (/^[\d.]+$/.test(host) || host.includes(':')) return false
  return host !== 'news.google.com'
}

/** The original article of a link; empty when the page cannot be read (blocked, not HTML, too slow). */
export async function fetchArticle(url: string): Promise<Article> {
  if (!readablePage(url)) return { text: '', images: [] }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'vi,en;q=0.8' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('html')) return { text: '', images: [] }
    const html = await response.text()
    return extractArticle(html.length > MAX_BYTES ? html.slice(0, MAX_BYTES) : html, response.url || url)
  } catch {
    return { text: '', images: [] }
  }
}
