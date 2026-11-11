import type { MessageKey } from '@/i18n'
import type { OrderStatus } from '@/services/types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, MessageKey> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã huỷ',
  expired: 'Hết hạn',
}
