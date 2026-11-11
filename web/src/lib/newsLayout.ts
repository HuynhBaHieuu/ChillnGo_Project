/**
 * How a news post is laid out: the first picture is the cover, the next ones
 * sit between paragraphs (spread evenly, never after the last one), and what
 * is left goes to a gallery under the text. Mirrored on mobile in
 * `mobile/lib/core/news_layout.dart`.
 */

export type NewsBlock = { kind: 'text'; text: string } | { kind: 'image'; url: string }

export interface NewsLayout {
  cover: string | null
  blocks: NewsBlock[]
  gallery: string[]
}

export function newsLayout(content: string[], images: string[]): NewsLayout {
  const [cover = null, ...rest] = images
  const gaps = Math.max(content.length - 1, 0)
  const inline = rest.slice(0, gaps)
  // after[k] = how many paragraphs come before the k-th inline picture.
  const after = inline.map((_, k) => Math.floor(((k + 1) * content.length) / (inline.length + 1)))
  const blocks: NewsBlock[] = []
  content.forEach((text, index) => {
    blocks.push({ kind: 'text', text })
    inline.forEach((url, k) => {
      if (after[k] === index + 1) blocks.push({ kind: 'image', url })
    })
  })
  return { cover, blocks, gallery: rest.slice(inline.length) }
}

/** The video id in a YouTube link (watch, youtu.be, shorts, embed, live); null for other links. */
export function youtubeId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  const id =
    host === 'youtu.be'
      ? parsed.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? (parsed.searchParams.get('v') ?? /^\/(?:shorts|embed|live)\/([^/]+)/.exec(parsed.pathname)?.[1] ?? '')
        : ''
  return /^[\w-]{11}$/.test(id) ? id : null
}
