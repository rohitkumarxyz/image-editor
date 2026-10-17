import type { CheckoutOptions } from '../api/credits'

const SCRIPT_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js'

export interface CheckoutResult {
  /** Cashfree is moving this page to a bank / UPI page; it comes back on the return URL. */
  redirected: boolean
  /** Why checkout ended without a payment (closed, declined…), if Cashfree said. */
  error: string | null
}

interface CashfreeSdkResult {
  error?: { message?: string }
  redirect?: boolean
  paymentDetails?: unknown
}

interface CashfreeInstance {
  checkout: (options: { paymentSessionId: string; redirectTarget: '_modal' }) => Promise<CashfreeSdkResult>
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance
  }
}

let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.Cashfree) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load the payment window. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Opens Cashfree checkout as a popup and resolves when it closes. It never says on its own whether money
 * was taken: the caller always asks our server, which checks with Cashfree.
 */
export async function openCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  await loadScript()
  if (!window.Cashfree) throw new Error('Could not load the payment window.')

  const result = await window.Cashfree({ mode: options.mode }).checkout({ paymentSessionId: options.paymentSessionId, redirectTarget: '_modal' })
  return { redirected: result.redirect === true, error: result.error?.message ?? null }
}
