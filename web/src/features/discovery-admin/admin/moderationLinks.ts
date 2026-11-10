import type { ReportSnapshot, ReportTargetType } from '@/services/types'

/** Where a moderator can see the content in the app, when it has a page. */
export function linkFor(type: ReportTargetType, id: string, snapshot: ReportSnapshot): string | null {
  if (type === 'post') return `/posts/${id}`
  if (type === 'comment' && snapshot.postId) return `/posts/${snapshot.postId}#comments`
  if (type === 'user') return `/users/${id}`
  return null
}
