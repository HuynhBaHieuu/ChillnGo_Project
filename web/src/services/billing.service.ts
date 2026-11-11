/**
 * Buying Premium and the business "Đề xuất" package: server/src/routes/billing.ts.
 *
 * The buyer is sent to PayOS's checkout page (VietQR) and comes back to
 * /billing/result, which polls the order until PayOS confirms it.
 */

import type { Page } from './admin.service'
import { http } from './http'
import type { Order, OrderStatus, Plans, ProductId } from './types'

/** GET /api/billing/plans — prices, benefits, and your Premium when signed in. */
export function getPlans(): Promise<Plans> {
  return http<Plans>('/api/billing/plans')
}

/** POST /api/billing/checkout — a pending order with its PayOS checkout link. */
export async function checkout(product: ProductId, businessId?: string): Promise<Order> {
  const { order } = await http<{ order: Order }>('/api/billing/checkout', {
    method: 'POST',
    body: { product, ...(businessId && { businessId }) },
  })
  return order
}

/** GET /api/billing/orders — your orders, newest first. */
export async function getMyOrders(): Promise<Order[]> {
  const { items } = await http<{ items: Order[] }>('/api/billing/orders')
  return items
}

/** GET /api/billing/orders/:orderCode — a pending one is checked with PayOS first. */
export async function getOrder(orderCode: number): Promise<Order> {
  const { order } = await http<{ order: Order }>(`/api/billing/orders/${orderCode}`)
  return order
}

/* ------------------------------------------------------------------ admin */

export interface AdminOrder extends Order {
  buyer: { _id: string; username: string; displayName: string } | null
}

export interface RevenueSummary {
  revenue: number
  paidOrders: number
  revenue30: number
  paidOrders30: number
  byProduct: { product: ProductId; name: string; revenue: number; count: number }[]
  premiumMembers: number
  promotedBusinesses: number
}

/** GET /api/admin/orders — every order plus the revenue summary. */
export function getAdminOrders(params: { status?: OrderStatus; page?: number }): Promise<Page<AdminOrder> & { summary: RevenueSummary }> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const qs = search.toString()
  return http(`/api/admin/orders${qs ? `?${qs}` : ''}`)
}
