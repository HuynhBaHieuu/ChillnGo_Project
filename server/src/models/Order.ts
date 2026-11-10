import { Schema, model } from 'mongoose'

import { PRODUCT_IDS } from '../lib/plans.js'

export const ORDER_STATUSES = ['pending', 'paid', 'cancelled', 'expired'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * One purchase: Premium for an account, or the "Đề xuất" package for a
 * business. Created "pending" with a PayOS checkout link; turned "paid" exactly
 * once (lib/billing.ts), when PayOS confirms the full amount arrived.
 *
 * `orderCode` is the number PayOS knows the order by (a safe integer).
 */
const orderSchema = new Schema(
  {
    orderCode: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    product: { type: String, enum: PRODUCT_IDS, required: true },
    /** The business the package is for (product "business_boost_month"). */
    businessId: { type: String, default: null },
    /** VND, fixed when the order is made. */
    amount: { type: Number, required: true },
    days: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    checkoutUrl: { type: String, default: '' },
    paymentLinkId: { type: String, default: '' },
    /** The bank transfer reference PayOS reports. */
    reference: { type: String, default: '' },
    /** After this a pending order can no longer be paid. */
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    /** The plan's new end date this payment produced. */
    grantedUntil: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

orderSchema.index({ userId: 1, createdAt: -1 })
orderSchema.index({ status: 1, paidAt: -1 })

export const Order = model('Order', orderSchema)
export type OrderDocument = InstanceType<typeof Order>
