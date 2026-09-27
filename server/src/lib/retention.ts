/**
 * Soft deletion: deleted journeys and check-ins stay restorable for this long
 * ("Recently Deleted" in the web app), then are removed for good.
 */
export const RESTORE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Items deleted before this moment are past the restore window. */
export function restoreCutoff(now = Date.now()): Date {
  return new Date(now - RESTORE_DAYS * DAY_MS)
}

/** When an item deleted at `deletedAt` stops being restorable. */
export function purgeAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + RESTORE_DAYS * DAY_MS)
}
