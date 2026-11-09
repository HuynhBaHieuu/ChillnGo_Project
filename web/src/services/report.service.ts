/**
 * Reports ("Báo cáo") and the moderation queue, stored by the API:
 * server/src/routes/reports.ts for reporting, /api/admin/reports for moderators.
 *
 * Only content the API stores can be reported; the sample journeys and
 * accounts that live only in this browser (ids like p_001) cannot.
 */

import type { Page } from './admin.service'
import { http } from './http'
import type {
  ReportEntry,
  ReportGroup,
  ReportInput,
  ReportStatus,
  ReportTargetDetail,
  ReportTargetType,
  ResolveAction,
} from './types'

/** Whether `id` is something the API stores, and so can be reported. */
export function canReport(id: string | null | undefined): boolean {
  return Boolean(id && /^[a-f0-9]{24}$/.test(id))
}

/** POST /api/reports — 409 ALREADY_REPORTED the second time, 400 SELF_REPORT for your own. */
export async function createReport(input: ReportInput): Promise<void> {
  await http('/api/reports', { method: 'POST', body: input })
}

/** GET /api/admin/reports — reports grouped by the content they are about. */
export function getReportQueue(params: {
  status?: ReportStatus
  targetType?: ReportTargetType
  page?: number
}): Promise<Page<ReportGroup>> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.targetType) search.set('targetType', params.targetType)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const qs = search.toString()
  return http<Page<ReportGroup>>(`/api/admin/reports${qs ? `?${qs}` : ''}`)
}

/** GET /api/admin/reports/target/:type/:id — the content and every report about it. */
export function getReportTarget(
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ target: ReportTargetDetail; reports: ReportEntry[] }> {
  return http(`/api/admin/reports/target/${targetType}/${targetId}`)
}

/** POST /api/admin/reports/target/:type/:id/resolve — decides every pending report about it. */
export function resolveReport(
  targetType: ReportTargetType,
  targetId: string,
  action: ResolveAction,
  note: string,
): Promise<{ resolved: number; status: ReportStatus }> {
  return http(`/api/admin/reports/target/${targetType}/${targetId}/resolve`, {
    method: 'POST',
    body: { action, note },
  })
}

/** POST /api/admin/moderation/:type/:id/unhide — shows hidden content again. */
export function unhideContent(targetType: ReportTargetType, targetId: string): Promise<{ ok: true }> {
  return http(`/api/admin/moderation/${targetType}/${targetId}/unhide`, { method: 'POST' })
}
