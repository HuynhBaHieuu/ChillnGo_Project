import type { MessageKey } from '@/i18n'
import type { ReportAction, ReportReason, ReportStatus, ReportTargetType } from '@/services/types'

export const REPORT_REASONS: ReportReason[] = ['spam', 'inappropriate', 'scam', 'misinformation', 'harassment', 'other']

export const REPORT_REASON_LABELS: Record<ReportReason, MessageKey> = {
  spam: 'Spam hoặc quảng cáo',
  inappropriate: 'Nội dung không phù hợp',
  scam: 'Lừa đảo',
  misinformation: 'Thông tin sai lệch',
  harassment: 'Quấy rối hoặc bắt nạt',
  other: 'Khác',
}

/** "Báo cáo {thing}". */
export const REPORT_TARGET_LABELS: Record<ReportTargetType, MessageKey> = {
  post: 'hành trình',
  comment: 'bình luận',
  checkin: 'check-in',
  user: 'tài khoản',
  business: 'cơ sở kinh doanh',
  businessPost: 'bài quảng cáo',
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, MessageKey> = {
  pending: 'Chờ xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Bỏ qua',
}

export const REPORT_ACTION_LABELS: Record<ReportAction, MessageKey> = {
  none: 'Không vi phạm',
  hide: 'Đã ẩn',
  remove: 'Đã gỡ',
  lock: 'Đã khoá tài khoản',
}
