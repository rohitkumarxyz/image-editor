import { NextResponse, type NextRequest } from 'next/server'
import { securityHeaders } from './server/http/security.ts'

export const THEME_HEADER = 'x-theme'

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
  requestHeaders.set(THEME_HEADER, request.nextUrl.pathname.replace(/\/$/, '') === '/editor' ? 'dark' : 'light')

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  for (const [name, value] of headers) response.headers.set(name, value)
  return response
}

export const config = {
  matcher: ['/((?!api(?:/|$)).*)'],
}
