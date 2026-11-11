/**
 * Reports and moderation: the rules, kept free of the database so they can be
 * tested on their own. routes/reports.ts and routes/admin.ts apply them;
 * lib/reportTargets.ts reads and changes the reported content.
 */

import { z } from 'zod'

import type { AdminModule } from './permissions.js'

export const REPORT_TARGET_TYPES = ['post', 'comment', 'checkin', 'user', 'business', 'businessPost', 'news'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export const REPORT_REASONS = ['spam', 'inappropriate', 'scam', 'misinformation', 'harassment', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_STATUSES = ['pending', 'resolved', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** What was done, as stored on each report. */
export const REPORT_ACTIONS = ['none', 'hide', 'remove', 'lock'] as const
export type ReportAction = (typeof REPORT_ACTIONS)[number]

/** What a moderator can decide. "dismiss": no violation. */
export const RESOLVE_ACTIONS = ['dismiss', 'hide', 'remove', 'lock'] as const
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number]

/** This many different people reporting the same content hides it until a moderator decides. */
export const AUTO_HIDE_THRESHOLD = 5

/** At most this many reports per person per hour. */
export const REPORTS_PER_HOUR = 20

export const MAX_REPORT_NOTE = 500

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Nội dung không hợp lệ')

export const targetTypeSchema = z.enum(REPORT_TARGET_TYPES, 'Loại nội dung không hợp lệ')

export const createReportSchema = z
  .object({
    targetType: targetTypeSchema,
    targetId: objectId,
    reason: z.enum(REPORT_REASONS, 'Hãy chọn lý do báo cáo.'),
    note: z.string().trim().max(MAX_REPORT_NOTE, 'Ghi chú tối đa 500 ký tự').default(''),
  })
  .refine((r) => r.reason !== 'other' || r.note.length > 0, {
    message: 'Hãy mô tả vấn đề khi chọn lý do Khác.',
    path: ['note'],
  })

export const resolveSchema = z.object({
  action: z.enum(RESOLVE_ACTIONS, 'Quyết định không hợp lệ'),
  note: z.string().trim().max(MAX_REPORT_NOTE, 'Ghi chú tối đa 500 ký tự').default(''),
})

/** An account cannot be hidden or removed, only locked; content can have any decision. */
export function allowedActions(targetType: ReportTargetType): ResolveAction[] {
  if (targetType === 'user') return ['dismiss', 'lock']
  // News comes from outside sources: there is no ChillnGo account to lock.
  if (targetType === 'news') return ['dismiss', 'hide', 'remove']
  return [...RESOLVE_ACTIONS]
}

/** Locking an account is the Users module's power, so it needs that permission too. */
export function requiredModules(action: ResolveAction): AdminModule[] {
  return action === 'lock' ? ['reports', 'users'] : ['reports']
}

export function hasModules(permissions: readonly string[], needed: readonly AdminModule[]): boolean {
  return needed.every((module) => permissions.includes(module))
}

/** Reporting your own content or account. */
export function isSelfReport(reporterId: string, ownerId: string): boolean {
  return reporterId === ownerId
}

/** MongoDB's duplicate-key error: this person already reported this. */
export function isDuplicateReport(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 11000
}

/**
 * Whether reports from `distinctReporters` people should hide the content now.
 * Accounts are never hidden automatically, and hidden content stays as it is.
 */
export function shouldAutoHide(
  targetType: ReportTargetType,
  distinctReporters: number,
  alreadyHidden: boolean,
  threshold = AUTO_HIDE_THRESHOLD,
): boolean {
  return targetType !== 'user' && !alreadyHidden && distinctReporters >= threshold
}

/** How resolving with `action` leaves each pending report. */
export function outcomeOf(action: ResolveAction): { status: ReportStatus; action: ReportAction } {
  return action === 'dismiss' ? { status: 'dismissed', action: 'none' } : { status: 'resolved', action }
}

/** Counts each reason in a list, every reason present (zeros included). */
export function countReasons(reasons: readonly string[]): Record<ReportReason, number> {
  const counts = Object.fromEntries(REPORT_REASONS.map((r) => [r, 0])) as Record<ReportReason, number>
  for (const reason of reasons) if (reason in counts) counts[reason as ReportReason] += 1
  return counts
}

/** Text cut down for a snapshot or a notification. */
export function excerpt(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}
