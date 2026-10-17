import type { UserDoc, OrderDoc } from '../../db.ts'
import type { CreditPack } from '../../config.ts'
import { AppError } from '../../lib/errors.ts'
import { logger } from '../../lib/logger.ts'
import type { UsersRepo } from '../auth/users.repo.ts'
import type { CreditsService } from '../credits/credits.service.ts'
import { toPaise, type PaymentGateway, type PaidPayment } from './cashfree.client.ts'
import type { OrdersRepo } from './orders.repo.ts'

const SUCCESS_EVENT = 'PAYMENT_SUCCESS_WEBHOOK'

interface WebhookEvent {
  type?: string
  data?: {
    order?: { order_id?: string }
    payment?: { cf_payment_id?: string | number; payment_status?: string; payment_amount?: number }
  }
}

export interface PaymentsOptions {
  packs: CreditPack[]
  currency: string
  /** Public https URL of the app; return and webhook URLs are only sent to Cashfree when it is https. */
  appOrigin: string
}

export class PaymentsService {
  private readonly gateway: PaymentGateway | null
  private readonly orders: OrdersRepo
  private readonly users: UsersRepo
  private readonly credits: CreditsService
  private readonly options: PaymentsOptions

  constructor(gateway: PaymentGateway | null, orders: OrdersRepo, users: UsersRepo, credits: CreditsService, options: PaymentsOptions) {
    this.gateway = gateway
    this.orders = orders
    this.users = users
    this.credits = credits
    this.options = options
  }

  get enabled(): boolean {
    return this.gateway !== null
  }

  private requireGateway(): PaymentGateway {
    if (!this.gateway) throw new AppError('unavailable', 'Payments are not set up yet. Please try again later.')
    return this.gateway
  }

  listPacks() {
    return this.options.packs.map((p) => ({ id: p.id, name: p.name, credits: p.credits, amount: p.amount, currency: this.options.currency }))
  }

  /** Creates the Cashfree order and returns what the browser needs to open checkout. */
  async startCheckout(user: UserDoc, input: { packId: string; phone: string }) {
    const pack = this.options.packs.find((p) => p.id === input.packId)
    if (!pack) throw new AppError('bad_request', 'Unknown credit pack.')

    const gateway = this.requireGateway()
    if (user.phone !== input.phone) await this.users.updatePhone(user._id, input.phone)
    const order = await this.orders.create({ userId: user._id, packId: pack.id, credits: pack.credits, amount: pack.amount, currency: this.options.currency })
    const orderId = String(order._id)
    const secure = this.options.appOrigin.startsWith('https://')

    const { paymentSessionId } = await gateway.createOrder({
      orderId,
      amount: pack.amount,
      currency: this.options.currency,
      customer: { id: String(user._id), name: user.name, email: user.email, phone: input.phone },
      note: `${pack.credits} AI edit credits`,
      returnUrl: secure ? `${this.options.appOrigin}/account?order_id={order_id}` : null,
      notifyUrl: secure ? `${this.options.appOrigin}/api/payments/webhook` : null,
    })
    return { orderId, paymentSessionId, mode: gateway.mode }
  }

  /** Called by the browser after checkout closes. Asks Cashfree directly, so the browser can't fake a payment. */
  async confirm(user: UserDoc, orderId: string): Promise<number> {
    const order = await this.orders.findByOrderId(orderId)
    if (!order || !order.userId.equals(user._id)) throw new AppError('not_found', 'Order not found.')
    if (order.status === 'paid') return this.credits.balance(user._id)

    const payment = await this.requireGateway().findPaidPayment(orderId)
    if (!payment) throw new AppError('conflict', 'The payment was not completed. No money was taken; you can try again.')
    return this.fulfilIfFullyPaid(order, payment)
  }

  /** Cashfree's server-to-server notice; covers users who close the tab before the browser confirms. */
  async handleWebhook(rawBody: Buffer, timestamp: string, signature: string): Promise<void> {
    if (!this.requireGateway().verifyWebhook(rawBody, timestamp, signature)) throw new AppError('unauthorized', 'Invalid webhook signature.')
    const event = JSON.parse(rawBody.toString('utf8')) as WebhookEvent
    if (event.type !== SUCCESS_EVENT || event.data?.payment?.payment_status !== 'SUCCESS') return

    const orderId = event.data.order?.order_id
    const paymentId = event.data.payment.cf_payment_id
    const amount = event.data.payment.payment_amount
    if (!orderId || !paymentId || typeof amount !== 'number') return
    const order = await this.orders.findByOrderId(orderId)
    if (!order) {
      logger.warn('webhook_unknown_order', { orderId })
      return
    }
    // Answered with 200 either way; an error would only make Cashfree resend the same underpayment.
    if (toPaise(amount) < order.amount) {
      logger.warn('payment_underpaid', { orderId, paid: toPaise(amount), expected: order.amount })
      return
    }
    await this.fulfil(order, String(paymentId))
  }

  private async fulfilIfFullyPaid(order: OrderDoc, payment: PaidPayment): Promise<number> {
    if (payment.amount < order.amount) {
      logger.warn('payment_underpaid', { orderId: String(order._id), paid: payment.amount, expected: order.amount })
      throw new AppError('bad_request', 'The amount paid does not match the order. Please contact support.')
    }
    return this.fulfil(order, payment.paymentId)
  }

  /**
   * Safe to run any number of times, in any order, from the browser and the webhook: the credit grant is
   * keyed by the order, so it lands exactly once.
   */
  private async fulfil(order: OrderDoc, paymentId: string): Promise<number> {
    const orderId = String(order._id)
    await this.orders.markPaid(order._id, paymentId)
    const balance = await this.credits.change({
      userId: order.userId,
      delta: order.credits,
      reason: 'purchase',
      refId: orderId,
      onceKey: `order:${orderId}`,
    })
    if (balance !== null) logger.info('order_credited', { orderId, userId: String(order.userId), credits: order.credits })
    return balance ?? (await this.credits.balance(order.userId))
  }
}
