/**
 * /api/reports — people reporting a journey, comment, check-in or account.
 *
 *   POST /api/reports  { targetType, targetId, reason, note? } → 201 { report }
 *
 * You cannot report yourself or your own content (400 SELF_REPORT), report the
 * same thing twice (409 ALREADY_REPORTED), or send more than REPORTS_PER_HOUR
 * reports an hour (429). Once AUTO_HIDE_THRESHOLD different people have
 * reported the same content it is hidden until a moderator decides.
 * Moderators work through the reports under /api/admin/reports (routes/admin.ts).
 */

import { Router } from 'express'

import { HttpError } from '../lib/errors.js'
import { hideTarget, findTarget } from '../lib/reportTargets.js'
import { REPORTS_PER_HOUR, createReportSchema, isDuplicateReport, isSelfReport, shouldAutoHide } from '../lib/reports.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Report } from '../models/Report.js'

export const reportsRouter = Router()
reportsRouter.use(requireAuth, loadCurrentUser)

/** The reason the system gives when it hides content on its own. */
export const AUTO_HIDE_REASON = 'Tự động ẩn tạm vì nhiều người báo cáo, đang chờ kiểm duyệt.'

reportsRouter.post('/', async (req, res) => {
  const input = createReportSchema.parse(req.body)
  const user = currentUser(res)

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const lastHour = await Report.countDocuments({ reporterId: user._id, createdAt: { $gte: hourAgo } })
  if (lastHour >= REPORTS_PER_HOUR) {
    throw new HttpError(429, 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau một giờ.', 'RATE_LIMITED')
  }

  const target = await findTarget(input.targetType, input.targetId)
  if (!target || !target.visible) throw new HttpError(404, 'Không tìm thấy nội dung này.', 'NOT_FOUND')
  if (isSelfReport(user._id, target.ownerId)) {
    throw new HttpError(400, 'Bạn không thể báo cáo chính mình hoặc nội dung của mình.', 'SELF_REPORT')
  }

  let report
  try {
    report = await Report.create({
      reporterId: user._id,
      targetType: input.targetType,
      targetId: input.targetId,
      targetOwnerId: target.ownerId,
      reason: input.reason,
      note: input.note,
      snapshot: target.snapshot,
    })
  } catch (error) {
    if (isDuplicateReport(error)) throw new HttpError(409, 'Bạn đã báo cáo nội dung này rồi.', 'ALREADY_REPORTED')
    throw error
  }

  const reporters = await Report.distinct('reporterId', {
    targetType: input.targetType,
    targetId: input.targetId,
    status: 'pending',
  })
  if (shouldAutoHide(input.targetType, reporters.length, target.hidden)) {
    await hideTarget(input.targetType, input.targetId, 'system', AUTO_HIDE_REASON)
  }

  res.status(201).json({
    report: {
      _id: String(report._id),
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    },
  })
})
