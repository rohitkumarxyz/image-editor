import { AppError } from '../lib/errors.ts'
import type { Middleware } from './router.ts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface SecurityOptions {
  isProduction: boolean
  /** Per-request nonce for Next.js's own inline scripts on HTML pages. */
  nonce?: string
  /** `next dev` needs eval for React's debugging tools; never set in production. */
  allowEval?: boolean
}

/**
 * Security headers and a strict Content-Security-Policy (the same set Helmet sent). Allowed third parties:
 * Google Fonts (fonts), jsDelivr (Tesseract OCR worker, WASM core and language data), Cashfree (checkout), Google sign-in.
 */
export function securityHeaders({ isProduction, nonce, allowEval = false }: SecurityOptions): [string, string][] {
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'", 'blob:', 'https://cdn.jsdelivr.net', 'https://sdk.cashfree.com', 'https://accounts.google.com/gsi/client']
  if (nonce) scriptSrc.splice(1, 0, `'nonce-${nonce}'`)
  if (allowEval) scriptSrc.push("'unsafe-eval'")
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "connect-src 'self' data: blob: https://cdn.jsdelivr.net https://*.cashfree.com https://accounts.google.com/gsi/",
    "img-src 'self' data: blob: https://*.cashfree.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' data: https://fonts.gstatic.com",
    'frame-src https://*.cashfree.com https://accounts.google.com/gsi/',
    // Only behind HTTPS; on plain-http local runs it would break every request.
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ]
  return [
    ['Content-Security-Policy', directives.join(';')],
    // Cashfree may open a popup for UPI / bank pages and needs to talk back to this window.
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
    ['Origin-Agent-Cluster', '?1'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ...(isProduction ? [['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'] as [string, string]] : []),
    ['X-Content-Type-Options', 'nosniff'],
    ['X-DNS-Prefetch-Control', 'off'],
    ['X-Download-Options', 'noopen'],
    ['X-Frame-Options', 'SAMEORIGIN'],
    ['X-Permitted-Cross-Domain-Policies', 'none'],
    ['X-XSS-Protection', '0'],
  ]
}

/**
 * Blocks cross-site request forgery: a request that changes something must come from our own pages.
 * Browsers always send Origin on such requests; a missing or foreign Origin is rejected.
 */
export function requireSameOrigin(appOrigin: string): Middleware {
  return async (req, next) => {
    if (SAFE_METHODS.has(req.method)) return next()
    if (req.headers.get('origin') !== appOrigin) {
      throw new AppError('forbidden', 'This request was blocked for security reasons. Reload the page and try again.')
    }
    return next()
  }
}

/**
 * The client's IP, skipping `trustProxy` reverse proxies (like Express's `trust proxy`). Next.js puts the
 * socket address in X-Forwarded-For when no proxy sent one, so the last entry is the closest hop.
 */
export function clientIp(forwardedFor: string | null, trustProxy: number): string {
  const hops = (forwardedFor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (hops.length === 0) return ''
  const ip = hops[Math.max(0, hops.length - Math.max(1, trustProxy))]
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}
