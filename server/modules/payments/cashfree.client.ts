import type { CashfreeMode } from '../../config.ts'
import { AppError } from '../../lib/errors.ts'
import { hmacSha256Base64, safeEqual } from '../../lib/crypto.ts'
import { logger } from '../../lib/logger.ts'

const BASE_URL: Record<CashfreeMode, string> = {
  sandbox: 'https://sandbox.cashfree.com/pg',
  production: 'https://api.cashfree.com/pg',
}
const API_VERSION = '2025-01-01'
const REQUEST_TIMEOUT_MS = 15_000

export interface CreateOrderInput {
  orderId: string
  amount: number
  currency: string
  customer: { id: string; name: string; email: string; phone: string }
  note: string
  returnUrl: string | null
  notifyUrl: string | null
}

export interface PaidPayment {
  paymentId: string
  amount: number
}

export interface PaymentGateway {
  readonly mode: CashfreeMode
  createOrder(input: CreateOrderInput): Promise<{ paymentSessionId: string }>
  findPaidPayment(orderId: string): Promise<PaidPayment | null>
  verifyWebhook(rawBody: Buffer, timestamp: string, signature: string): boolean
}

interface CashfreePayment {
  cf_payment_id?: string | number
  payment_status?: string
  payment_amount?: number
}

export const toPaise = (rupees: number) => Math.round(rupees * 100)

export class CashfreeGateway implements PaymentGateway {
  readonly mode: CashfreeMode
  private readonly appId: string
  private readonly secretKey: string

  constructor(appId: string, secretKey: string, mode: CashfreeMode) {
    this.appId = appId
    this.secretKey = secretKey
    this.mode = mode
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    const response = await fetch(BASE_URL[this.mode] + path, {
      method,
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': API_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((err: unknown) => {
      logger.error('cashfree_unreachable', { path, error: String(err) })
      throw new AppError('upstream_failed', 'The payment service is not reachable. Please try again.')
    })
    const json = (await response.json().catch(() => null)) as (T & { message?: string; code?: string }) | null
    if (!response.ok || !json) {
      logger.error('cashfree_request_failed', { path, status: response.status, code: json?.code, error: json?.message })
      throw new AppError('upstream_failed', 'The payment service returned an error. Please try again.')
    }
    return json
  }

  async createOrder(input: CreateOrderInput): Promise<{ paymentSessionId: string }> {
    const json = await this.request<{ payment_session_id?: string }>('POST', '/orders', {
      order_id: input.orderId,
      order_amount: input.amount / 100,
      order_currency: input.currency,
      customer_details: {
        customer_id: input.customer.id,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
      },
      order_note: input.note,
      order_meta: {
        ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      },
    })
    if (!json.payment_session_id) {
      logger.error('cashfree_order_without_session', { orderId: input.orderId })
      throw new AppError('upstream_failed', 'Could not start the payment. Please try again.')
    }
    return { paymentSessionId: json.payment_session_id }
  }

  async findPaidPayment(orderId: string): Promise<PaidPayment | null> {
    const payments = await this.request<CashfreePayment[]>('GET', `/orders/${encodeURIComponent(orderId)}/payments`)
    const paid = Array.isArray(payments) ? payments.find((p) => p.payment_status === 'SUCCESS') : undefined
    if (!paid?.cf_payment_id || typeof paid.payment_amount !== 'number') return null
    return { paymentId: String(paid.cf_payment_id), amount: toPaise(paid.payment_amount) }
  }

  verifyWebhook(rawBody: Buffer, timestamp: string, signature: string): boolean {
    return safeEqual(hmacSha256Base64(this.secretKey, timestamp + rawBody.toString('utf8')), signature)
  }
}
