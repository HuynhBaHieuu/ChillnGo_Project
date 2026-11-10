/**
 * PayOS, the VietQR payment gateway (https://payos.vn/docs/api/).
 *
 * Spoken to over plain HTTPS rather than through an SDK: three calls and one
 * signature scheme. Every request and webhook is signed with HMAC-SHA256 over
 * `key=value` pairs sorted by key and joined with `&`, keyed by the channel's
 * checksum key.
 *
 *   createPaymentLink   a checkout page for one order
 *   getPaymentInfo      where a payment stands (PAID, PENDING, CANCELLED…)
 *   verifyWebhook       checks a webhook really comes from PayOS
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import { env } from '../env.js'
import { HttpError } from './errors.js'

type Data = Record<string, unknown>

function sortByKey<T extends Data>(object: T): T {
  return Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]])) as T
}

/**
 * The string PayOS signs: keys sorted, `key=value` joined with `&`. null and
 * undefined become empty; arrays (the order items) are JSON with sorted keys.
 */
export function signedString(data: Data): string {
  const sorted = sortByKey(data)
  return Object.keys(sorted)
    .filter((key) => sorted[key] !== undefined)
    .map((key) => {
      let value = sorted[key]
      if (Array.isArray(value)) value = JSON.stringify(value.map((item) => (item && typeof item === 'object' ? sortByKey(item as Data) : item)))
      if (value === null || value === undefined || value === 'null' || value === 'undefined') value = ''
      return `${key}=${String(value)}`
    })
    .join('&')
}

export function sign(data: Data, checksumKey: string): string {
  return createHmac('sha256', checksumKey).update(signedString(data)).digest('hex')
}

/** Whether `signature` is PayOS's signature of `data`. Constant time. */
export function isValidSignature(data: Data, signature: string, checksumKey: string): boolean {
  const expected = Buffer.from(sign(data, checksumKey), 'hex')
  const given = Buffer.from(/^[a-f0-9]+$/i.test(signature) ? signature : '', 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function config() {
  if (!env.payos) {
    throw new HttpError(503, 'Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.', 'PAYMENTS_NOT_CONFIGURED')
  }
  return env.payos
}

interface PayOSResponse<T> {
  code: string
  desc: string
  data: T | null
  signature?: string
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: Data): Promise<T> {
  const { clientId, apiKey, apiUrl } = config()
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { 'x-client-id': clientId, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    console.error('PayOS unreachable:', (error as Error).message)
    throw new HttpError(502, 'Không kết nối được cổng thanh toán. Vui lòng thử lại sau.', 'PAYMENT_GATEWAY_ERROR')
  }
  const json = (await response.json().catch(() => null)) as PayOSResponse<T> | null
  if (!json || json.code !== '00' || !json.data) {
    console.error(`PayOS ${method} ${path} failed:`, response.status, json?.code, json?.desc)
    throw new HttpError(502, 'Cổng thanh toán từ chối yêu cầu. Vui lòng thử lại sau.', 'PAYMENT_GATEWAY_ERROR')
  }
  return json.data
}

export interface PaymentLinkRequest {
  orderCode: number
  amount: number
  /** At most 9 characters: some banks cut longer transfer notes. */
  description: string
  returnUrl: string
  cancelUrl: string
  items: { name: string; quantity: number; price: number }[]
  /** Unix seconds. */
  expiredAt: number
}

export interface PaymentLink {
  checkoutUrl: string
  paymentLinkId: string
  qrCode: string
}

/** POST /v2/payment-requests: a checkout page for one order. */
export async function createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink> {
  const { checksumKey } = config()
  const { amount, cancelUrl, description, orderCode, returnUrl } = request
  const signature = sign({ amount, cancelUrl, description, orderCode, returnUrl }, checksumKey)
  return call<PaymentLink>('POST', '/v2/payment-requests', { ...request, signature })
}

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'UNDERPAID'

export interface PaymentInfo {
  orderCode: number
  amount: number
  amountPaid: number
  status: PaymentStatus
}

/** GET /v2/payment-requests/{orderCode} */
export async function getPaymentInfo(orderCode: number): Promise<PaymentInfo> {
  return call<PaymentInfo>('GET', `/v2/payment-requests/${orderCode}`)
}

export interface WebhookData {
  orderCode: number
  amount: number
  /** "00" for a successful payment. */
  code: string
  paymentLinkId?: string
  reference?: string
  transactionDateTime?: string
  [key: string]: unknown
}

/** The webhook's `data` if its signature checks out, else null. */
export function verifyWebhook(body: unknown): WebhookData | null {
  const { checksumKey } = config()
  const payload = body as { data?: unknown; signature?: unknown } | null
  if (!payload || typeof payload.data !== 'object' || payload.data === null || typeof payload.signature !== 'string') return null
  const data = payload.data as WebhookData
  return isValidSignature(data, payload.signature, checksumKey) ? data : null
}
