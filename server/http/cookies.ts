import { SESSION_TTL_MS } from '../modules/auth/auth.service.ts'

export interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  /** Milliseconds, like Express; also sets Expires. */
  maxAge?: number
  expires?: Date
}

export interface SessionCookie {
  name: string
  options: CookieOptions
}

/**
 * HttpOnly so page scripts can't read it, SameSite=Lax against cross-site posts, and in production the
 * `__Host-` prefix, which browsers only accept with Secure, path=/ and no Domain (no subdomain overrides).
 */
export function sessionCookie(isProduction: boolean): SessionCookie {
  return {
    name: isProduction ? '__Host-sid' : 'sid',
    options: { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_MS },
  }
}

/** Same attribute order and format as Express's `res.cookie` / `res.clearCookie`. */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`)
    parts.push(`Expires=${new Date(Date.now() + options.maxAge).toUTCString()}`)
  } else if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }
  parts.push(`Path=${options.path}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  parts.push('SameSite=Lax')
  return parts.join('; ')
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const pair of (header ?? '').split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const key = pair.slice(0, eq).trim()
    if (!key || key in cookies) continue
    let value = pair.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    try {
      cookies[key] = decodeURIComponent(value)
    } catch {
      cookies[key] = value
    }
  }
  return cookies
}
