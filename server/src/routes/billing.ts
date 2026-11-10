/**
 * /api/billing — buying Premium and the business "Đề xuất" package through PayOS.
 *
 *   GET  /api/billing/plans               prices, what each plan gives, your current Premium
 *   POST /api/billing/checkout            { product, businessId? } → 201 { order } with its checkoutUrl
 *   GET  /api/billing/orders              your orders, newest first
 *   GET  /api/billing/orders/:orderCode   one of your orders; a pending one is checked with PayOS first
 *   POST /api/billing/payos-webhook       PayOS reporting a payment (signed with the checksum key)
 *
 * The buyer pays on PayOS's page and comes back to the web app's
 * /billing/result (the mobile app watches its WebView for that address), which
 * asks GET /orders/:orderCode until the order is paid. lib/billing.ts holds
 * the rules.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { env } from '../env.js'
import { createCheckout, orderView, remindRenewal, syncWithGateway, fulfill } from '../lib/billing.js'
import { HttpError, rateLimitBody } from '../lib/errors.js'
import { verifyWebhook } from '../lib/payos.js'
import { PRODUCTS, PRODUCT_IDS, isPremium, planBenefits } from '../lib/plans.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { Business } from '../models/Business.js'
import { Order } from '../models/Order.js'
import { User } from '../models/User.js'

export const billingRouter = Router()

/** Where PayOS sends the buyer back, paid or not. */
export function resultUrl(): string {
  return `${env.appUrl}/billing/result`
}

billingRouter.get('/plans', optionalAuth, async (_req, res) => {
  const userId = res.locals.userId as string | undefined
  const user = userId ? await User.findById(userId).select('premiumUntil').lean() : null
  if (user) await remindRenewal(userId!)
  res.json({
    paymentsEnabled: Boolean(env.payos),
    products: PRODUCT_IDS.map((id) => PRODUCTS[id]),
    benefits: planBenefits(),
    current: user
      ? { isPremium: isPremium(user), premiumUntil: user.premiumUntil?.toISOString() ?? null }
      : null,
  })
})

const checkoutSchema = z.object({
  product: z.enum(PRODUCT_IDS, 'Gói không hợp lệ'),
  businessId: z.string().regex(/^[a-f0-9]{24}$/, 'Cơ sở không hợp lệ').optional(),
})

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitBody('Bạn thao tác thanh toán quá nhanh. Vui lòng đợi vài phút.'),
})

billingRouter.post('/checkout', requireAuth, loadCurrentUser, checkoutLimiter, async (req, res) => {
  const input = checkoutSchema.parse(req.body)
  const user = currentUser(res)
  const product = PRODUCTS[input.product]

  let businessId: string | null = null
  if (product.kind === 'boost') {
    const business = await Business.findOne({ ownerId: user._id }).select('status').lean()
    if (!business || (input.businessId && String(business._id) !== input.businessId)) {
      throw new HttpError(404, 'Bạn chưa có cơ sở kinh doanh nào.', 'NOT_FOUND')
    }
    if (business.status !== 'approved') {
      throw new HttpError(400, 'Cơ sở của bạn cần được duyệt trước khi mua gói Đề xuất.', 'BUSINESS_NOT_APPROVED')
    }
    businessId = String(business._id)
  }

  const order = await createCheckout({
    userId: user._id,
    product: product.id,
    businessId,
    returnUrl: resultUrl(),
    cancelUrl: resultUrl(),
  })
  res.status(201).json({ order: orderView(order) })
})

billingRouter.get('/orders', requireAuth, loadCurrentUser, async (_req, res) => {
  const orders = await Order.find({ userId: currentUser(res)._id }).sort({ createdAt: -1 }).limit(50)
  res.json({ items: orders.map(orderView) })
})

billingRouter.get('/orders/:orderCode', requireAuth, loadCurrentUser, async (req, res) => {
  const orderCode = Number(req.params.orderCode)
  const order = Number.isSafeInteger(orderCode)
    ? await Order.findOne({ orderCode, userId: currentUser(res)._id })
    : null
  if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.', 'NOT_FOUND')
  res.json({ order: orderView(await syncWithGateway(order)) })
})

/**
 * PayOS calls this for every payment on the channel. Answers 200 to anything
 * signed correctly, including PayOS's test call when the URL is saved and
 * orders this server does not know, so PayOS does not keep retrying.
 */
billingRouter.post('/payos-webhook', async (req, res) => {
  if (!env.payos) throw new HttpError(503, 'Payments are not configured', 'PAYMENTS_NOT_CONFIGURED')
  const data = verifyWebhook(req.body)
  if (!data) throw new HttpError(401, 'Invalid signature', 'BAD_WEBHOOK')
  if (data.code === '00' && Number.isSafeInteger(data.orderCode)) {
    await fulfill(data.orderCode, { amount: Number(data.amount), reference: String(data.reference ?? '') })
  }
  res.json({ success: true })
})
