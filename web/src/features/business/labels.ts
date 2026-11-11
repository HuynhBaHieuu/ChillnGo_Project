import type { MessageKey } from '@/i18n'
import type { BusinessStatus, BusinessType } from '@/services/types'

export const BUSINESS_TYPES: BusinessType[] = ['homestay', 'hotel', 'restaurant', 'cafe', 'tour']

export const BUSINESS_TYPE_LABELS: Record<BusinessType, MessageKey> = {
  homestay: 'Homestay',
  hotel: 'Khách sạn',
  restaurant: 'Quán ăn',
  cafe: 'Cà phê',
  tour: 'Tour – trải nghiệm',
}

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, MessageKey> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  hidden: 'Đang bị ẩn',
}

/** "Giá" unit by type: per night for a stay, per person otherwise. */
export function priceUnit(type: BusinessType): MessageKey {
  return type === 'homestay' || type === 'hotel' ? '/đêm' : '/người'
}
