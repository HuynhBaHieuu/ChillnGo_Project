import { useMutation } from '@tanstack/react-query'

import { billingService } from '@/services'
import type { ProductId } from '@/services/types'

/** Where the result page keeps the order being paid, so it knows which one to check on return. */
export const PENDING_ORDER_KEY = 'chillngo.pendingOrder'

/**
 * Starts a purchase: makes the order, remembers it, and leaves for PayOS's
 * checkout page. PayOS sends the buyer back to /billing/result.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: ({ product, businessId }: { product: ProductId; businessId?: string }) =>
      billingService.checkout(product, businessId),
    onSuccess: (order) => {
      sessionStorage.setItem(PENDING_ORDER_KEY, String(order.orderCode))
      window.location.assign(order.checkoutUrl)
    },
  })
}
