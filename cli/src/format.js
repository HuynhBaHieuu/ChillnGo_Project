/** Human-readable output for each command. `--json` skips all of this. */

/** @param {number | null | undefined} amount */
export function vnd(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`
}

/** @param {{ _id: string, title?: string, region?: string, season?: string, days?: unknown[], totalEstCost?: number, likeCount?: number, cloneCount?: number }[]} posts */
export function formatPosts(posts) {
  if (posts.length === 0) return 'No journeys.'
  return posts
    .map((p) => {
      const facts = [
        p.region,
        p.season,
        `${p.days?.length ?? 0} days`,
        vnd(p.totalEstCost),
        `♥ ${p.likeCount ?? 0}`,
        `${p.cloneCount ?? 0} clones`,
      ].filter(Boolean)
      return `${p._id}  ${p.title ?? '(untitled)'}\n    ${facts.join(' · ')}`
    })
    .join('\n')
}

/**
 * @param {{ title?: string, summary?: string, startDate?: string, endDate?: string, totalEstCost?: number, tags?: string[],
 *   days?: { dayNumber?: number, date?: string, title?: string, locations?: { name?: string, note?: string, estCost?: number }[] }[] }} post
 */
export function formatPost(post) {
  const lines = [`${post.title ?? '(untitled)'}`]
  if (post.summary) lines.push(post.summary)
  const range = [post.startDate, post.endDate].filter(Boolean).join(' → ')
  lines.push([range, `total ${vnd(post.totalEstCost)}`, ...(post.tags ?? []).map((t) => `#${t}`)].filter(Boolean).join(' · '))
  for (const day of post.days ?? []) {
    lines.push('', `Day ${day.dayNumber ?? '?'}${day.date ? ` (${day.date})` : ''}${day.title ? ` — ${day.title}` : ''}`)
    for (const stop of day.locations ?? []) {
      lines.push(`  • ${stop.name ?? '?'}  ${vnd(stop.estCost)}${stop.note ? `\n      ${stop.note}` : ''}`)
    }
  }
  return lines.join('\n')
}

/** @param {{ _id: string, caption?: string, createdAt?: string, location?: { name?: string } | null, author?: { username?: string } }[]} items */
export function formatCheckins(items) {
  if (items.length === 0) return 'No check-ins.'
  return items
    .map((c) => {
      const where = c.location?.name ? ` @ ${c.location.name}` : ''
      return `${c._id}  ${c.author?.username ?? '?'}${where}  ${c.createdAt ?? ''}\n    ${c.caption || '(no caption)'}`
    })
    .join('\n')
}

/** @param {{ _id: string, title?: string, viewerCount?: number, startedAt?: string, host?: { username?: string } }[]} items */
export function formatLivestreams(items) {
  if (items.length === 0) return 'Nobody is live right now.'
  return items
    .map((s) => `${s._id}  ${s.title ?? '(untitled)'}\n    ${s.host?.username ?? '?'} · ${s.viewerCount ?? 0} watching · since ${s.startedAt ?? '?'}`)
    .join('\n')
}

/** @param {{ _id: string, username?: string, displayName?: string, bio?: string, location?: string, followerCount?: number, followingCount?: number, postCount?: number }} user */
export function formatUser(user) {
  const lines = [`${user.displayName ?? ''} (@${user.username ?? '?'})  ${user._id}`]
  if (user.bio) lines.push(user.bio)
  if (user.location) lines.push(user.location)
  lines.push(`${user.postCount ?? 0} journeys · ${user.followerCount ?? 0} followers · ${user.followingCount ?? 0} following`)
  return lines.join('\n')
}
