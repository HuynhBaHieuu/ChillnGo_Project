import { HttpError } from './errors.js'

/** Refuses sign-in to a locked account, with the reason the admin gave. */
export function assertNotLocked(user: { status?: string | null; lockedReason?: string | null }): void {
  if (user.status !== 'locked') return
  const reason = user.lockedReason?.trim()
  throw new HttpError(
    403,
    `Tài khoản của bạn đã bị khoá${reason ? `: ${reason}` : ''}. Liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.`,
    'ACCOUNT_LOCKED',
  )
}
