/**
 * Orders: making one with a PayOS checkout link, and turning it "paid" once
 * PayOS confirms the money arrived, which is when the buyer gets what they paid
 * for. Used by routes/billing.ts.
 *
 * A payment is confirmed two ways, whichever comes first:
 *   - PayOS's webhook (POST /api/billing/payos-webhook);
 *   - the result page asking about its order: a pending one is checked with
 *     PayOS right then, so a server PayOS cannot reach (localhost) still works.
 * Either way `fulfill` flips the order with a conditional update, so the plan
 * is extended exactly once however many confirmations arrive.
 */

import { randomInt } from 'node:crypto'

import { env } from '../env.js'
import { HttpError } from './errors.js'
import { createPaymentLink, getPaymentInfo } from './payos.js'
import { PRODUCTS, RENEWAL_REMINDER_DAYS, DAY_MS, extendUntil } from './plans.js'
import type { ProductId } from './plans.js'
import { Business } from '../models/Business.js'
import { notify } from '../models/Notification.js'
import { Order } from '../models/Order.js'
import type { OrderDocument } from '../models/Order.js'
import { User } from '../models/User.js'

/** A checkout link stays payable this long. */
export const CHECKOUT_MINUTES = 15

/** At most this many unpaid orders per person in the last hour. */
export const PENDING_ORDERS_PER_HOUR = 10

/** A new PayOS order code: milliseconds times 1000 plus a random tail, always a safe integer. */
export function newOrderCode(now = Date.now()): number {
  return now * 1000 + randomInt(1000)
}

const money = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`

export function orderView(order: OrderDocument) {
  const product = PRODUCTS[order.product as ProductId]
  return {
    _id: String(order._id),
    orderCode: order.orderCode,
    product: order.product,
    productName: product?.name ?? order.product,
    businessId: order.businessId,
    amount: order.amount,
    days: order.days,
    status: order.status,
    checkoutUrl: order.status === 'pending' ? order.checkoutUrl : '',
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    grantedUntil: order.grantedUntil?.toISOString() ?? null,
  }
}

/**
 * Makes a pending order and its PayOS checkout page. `returnUrl` is where PayOS
 * sends the buyer back (the web app's result page, or a URL the mobile app
 * watches for); PayOS appends ?code=…&orderCode=…&status=… to it.
 */
export async function createCheckout(input: {
  userId: string
  product: ProductId
  businessId: string | null
  returnUrl: string
  cancelUrl: string
}): Promise<OrderDocument> {
  const product = PRODUCTS[input.product]
  if (!env.payos) {
    throw new HttpError(503, 'Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.', 'PAYMENTS_NOT_CONFIGURED')
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await Order.countDocuments({ userId: input.userId, status: 'pending', createdAt: { $gte: hourAgo } })
  if (recent >= PENDING_ORDERS_PER_HOUR) {
    throw new HttpError(429, 'Bạn đã tạo quá nhiều đơn chưa thanh toán. Vui lòng thử lại sau.', 'RATE_LIMITED')
  }

  const expiresAt = new Date(Date.now() + CHECKOUT_MINUTES * 60 * 1000)
  const order = await Order.create({
    orderCode: newOrderCode(),
    userId: input.userId,
    product: product.id,
    businessId: input.businessId,
    amount: product.amount,
    days: product.days,
    expiresAt,
  })

  try {
    const link = await createPaymentLink({
      orderCode: order.orderCode,
      amount: order.amount,
      description: 'ChillnGo',
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      items: [{ name: product.name, quantity: 1, price: product.amount }],
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
    })
    order.set({ checkoutUrl: link.checkoutUrl, paymentLinkId: link.paymentLinkId })
    await order.save()
  } catch (error) {
    order.set({ status: 'cancelled' })
    await order.save()
    throw error
  }
  return order
}

/**
 * Turns a pending order paid and gives the buyer the plan. Idempotent: only
 * the call that actually flips the order extends anything. Returns the order
 * as it stands afterwards.
 */
export async function fulfill(orderCode: number, paid: { amount: number; reference?: string }): Promise<OrderDocument | null> {
  const existing = await Order.findOne({ orderCode })
  if (!existing) return null
  if (existing.status === 'paid') return existing
  if (paid.amount < existing.amount) {
    console.error(`Order ${orderCode}: paid ${paid.amount}, expected ${existing.amount}. Not fulfilled.`)
    return existing
  }

  // A late payment for an order we had marked expired still counts: the money arrived.
  const order = await Order.findOneAndUpdate(
    { orderCode, status: { $in: ['pending', 'expired', 'cancelled'] } },
    { $set: { status: 'paid', paidAt: new Date(), reference: paid.reference ?? '' } },
    { new: true },
  )
  if (!order) return Order.findOne({ orderCode })

  const product = PRODUCTS[order.product as ProductId]
  let until: Date | null = null
  if (product.kind === 'premium') {
    const user = await User.findById(order.userId).select('premiumUntil')
    if (user) {
      until = extendUntil(user.premiumUntil, order.days)
      user.premiumUntil = until
      await user.save()
    }
  } else {
    const business = await Business.findById(order.businessId)
    if (business) {
      until = extendUntil(business.promotedUntil, order.days)
      business.promotedUntil = until
      await business.save()
    }
  }
  order.grantedUntil = until
  await order.save()

  const end = until ? until.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''
  await notify([order.userId], {
    type: 'billing',
    actorId: null,
    message: `Thanh toán ${money(order.amount)} thành công. ${product.name} có hiệu lực đến ${end}.`,
  })
  return order
}

/**
 * Brings a pending order in line with PayOS: paid, cancelled or expired. Left
 * alone when PayOS cannot be reached. Returns the order afterwards.
 */
export async function syncWithGateway(order: OrderDocument): Promise<OrderDocument> {
  if (order.status !== 'pending' || !env.payos) return order
  const info = await getPaymentInfo(order.orderCode).catch(() => null)
  if (info?.status === 'PAID') return (await fulfill(order.orderCode, { amount: info.amountPaid || info.amount })) ?? order
  if (info?.status === 'CANCELLED') order.status = 'cancelled'
  else if (info?.status === 'EXPIRED' || order.expiresAt.getTime() < Date.now() - 5 * 60 * 1000) order.status = 'expired'
  if (order.isModified()) await order.save()
  return order
}

/**
 * Sends the "about to run out" notice once per Premium period, when fewer than
 * RENEWAL_REMINDER_DAYS are left. Called when the member loads their account.
 */
export async function remindRenewal(userId: string): Promise<void> {
  const now = Date.now()
  const user = await User.findById(userId).select('premiumUntil premiumReminderFor')
  const until = user?.premiumUntil
  if (!user || !until || until.getTime() <= now) return
  if (until.getTime() - now > RENEWAL_REMINDER_DAYS * DAY_MS) return
  if (user.premiumReminderFor?.getTime() === until.getTime()) return
  user.premiumReminderFor = until
  await user.save()
  const end = until.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  await notify([userId], {
    type: 'billing',
    actorId: null,
    message: `Gói Premium của bạn sẽ hết hạn vào ${end}. Gia hạn để tiếp tục dùng nhiều lượt AI và livestream 1080p.`,
  })
}
