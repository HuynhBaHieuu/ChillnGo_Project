import { countFollowsOf } from '../models/Follow.js'
import type { UserDocument } from '../models/User.js'
import { endStreamsOf } from '../routes/livestreams.js'

/**
 * Bans an account: it can no longer sign in, the stream it is hosting ends and
 * it stops counting in other accounts' follower / following counts. Locking an
 * account that is already locked only changes the reason. Used by
 * POST /api/admin/users/:id/lock and by resolving a report with "lock"; the
 * caller checks permissions and writes the audit log.
 */
export async function lockAccount(target: UserDocument, reason: string): Promise<void> {
  const wasActive = target.status === 'active'
  target.set({ status: 'locked', lockedReason: reason, ...(wasActive ? { lockedAt: new Date() } : {}) })
  await target.save()
  if (wasActive) {
    await endStreamsOf(target._id)
    await countFollowsOf(target._id, false)
  }
}
