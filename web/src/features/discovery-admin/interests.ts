import type { TripPostWithAuthor } from '@/services/types'

export interface InterestTile {
  tag: string
  image: string
}

/** Where an interest tile leads: that interest's own page. */
export function interestPath(tag: string): string {
  return `/discover/interest/${encodeURIComponent(tag)}`
}

/** Hero titles for the common interests; anything else gets the generic line. */
const HEADLINES: Record<string, string> = {
  'ẩm thực': 'Đi để ăn',
  biển: 'Ra biển thôi',
  núi: 'Lên núi thôi',
  'tiết kiệm': 'Đi xa, tiêu ít',
  'săn mây': 'Săn mây trên đỉnh',
  trekking: 'Xỏ giày lên đường',
  'cà phê': 'Đi để ngồi cà phê',
  'văn hóa': 'Đi để hiểu',
  'lặn biển': 'Lặn xuống biển xanh',
}

export function interestHeadline(tag: string): string {
  return HEADLINES[tag] ?? `Dành cho người mê ${tag}`
}

/**
 * The most-used tags, each pictured by the trip that lists it earliest among
 * its own tags (so "ẩm thực" isn't shown with a beach), the most saved winning
 * ties; a cover is used at most once.
 *
 * `posts` must already be sorted by saves.
 */
export function pickInterestTiles(
  posts: TripPostWithAuthor[],
  count: number,
  exclude: string[] = [],
): InterestTile[] {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!exclude.includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  const used = new Set<string>()
  const tiles: InterestTile[] = []
  for (const [tag] of [...counts].sort((a, b) => b[1] - a[1])) {
    // Stable sort, so the saves order survives as the tiebreak.
    const post = posts
      .filter((p) => p.tags.includes(tag) && !used.has(p.coverUrl))
      .sort((x, y) => x.tags.indexOf(tag) - y.tags.indexOf(tag))[0]
    if (!post) continue
    used.add(post.coverUrl)
    tiles.push({ tag, image: post.coverUrl })
    if (tiles.length === count) break
  }
  return tiles
}
