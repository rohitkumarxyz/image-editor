import { api } from './client'

export type LedgerReason = 'signup_bonus' | 'purchase' | 'ai_edit' | 'ai_edit_refund'

export interface LedgerEntry {
  id: string
  delta: number
  reason: LedgerReason
  balanceAfter: number
  createdAt: string
}

export interface CreditPack {
  id: string
  name: string
  credits: number
  amount: number
  currency: string
}

export interface CheckoutOptions {
  orderId: string
  paymentSessionId: string
  mode: 'sandbox' | 'production'
}

export const creditsApi = {
  history: () => api<{ entries: LedgerEntry[] }>('/credits/history').then((r) => r.entries),
  packs: () => api<{ packs: CreditPack[]; enabled: boolean }>('/payments/packs'),
  startCheckout: (input: { packId: string; phone: string }) => api<{ checkout: CheckoutOptions }>('/payments/orders', { body: input }).then((r) => r.checkout),
  confirm: (orderId: string) => api<{ credits: number }>('/payments/confirm', { body: { orderId } }).then((r) => r.credits),
}
