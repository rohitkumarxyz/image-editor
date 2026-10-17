import { NextResponse, type NextRequest } from 'next/server'
import { securityHeaders } from './server/http/security.ts'

export const THEME_HEADER = 'x-theme'

/**
 * Pages and static files get the security headers here; `/api` sets its own (and is skipped, so large AI
 * uploads aren't buffered by the proxy). Every page gets a fresh nonce, which Next.js puts on its inline scripts.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const headers = securityHeaders({
    isProduction: process.env.NODE_ENV === 'production',
    nonce,
    allowEval: process.env.NODE_ENV === 'development',
  })
  const csp = headers.find(([name]) => name === 'Content-Security-Policy')![1]

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', csp)
  // The editor keeps its dark workspace; the website pages are light.
  requestHeaders.set(THEME_HEADER, request.nextUrl.pathname.replace(/\/$/, '') === '/editor' ? 'dark' : 'light')

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  for (const [name, value] of headers) response.headers.set(name, value)
  return response
}

export const config = {
  matcher: ['/((?!api(?:/|$)).*)'],
}
