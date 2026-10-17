import { isIPv6 } from 'node:net'
import type { ApiRequest, Middleware } from './router.ts'
import { Reply } from './router.ts'

const MINUTE = 60_000
const SWEEP_INTERVAL_MS = MINUTE

interface Hits {
  count: number
  resetAt: number
}

interface LimiterOptions {
  keyGenerator?: (req: ApiRequest) => string
  /** Count only failed requests (4xx/5xx), e.g. wrong passwords. */
  onlyFailures?: boolean
}

/** IPv6 users usually get a whole /56 block, so they are limited per block, not per address. */
function ipKey(ip: string): string {
  if (!isIPv6(ip)) return ip
  const [head, tail = ''] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right].map((g) => parseInt(g || '0', 16))
  // /56 keeps the first three groups and the high byte of the fourth.
  const masked = [groups[0], groups[1], groups[2], groups[3] & 0xff00, 0, 0, 0, 0].map((g) => g.toString(16))
  return `${masked.join(':')}/56`
}

/** Fixed-window counter per key, kept in this process's memory (one server instance). */
function limiter(windowMs: number, limit: number, message: string, { keyGenerator = (req) => ipKey(req.ip), onlyFailures = false }: LimiterOptions = {}): Middleware {
  const hits = new Map<string, Hits>()
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key)
  }, SWEEP_INTERVAL_MS)
  sweep.unref()

  const windowSeconds = Math.ceil(windowMs / 1000)
  const policy = `"${limit}-in-${windowSeconds}sec"`

  return async (req, next) => {
    const key = keyGenerator(req)
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count++
    const current = entry

    const withHeaders = (reply: Reply) => {
      reply.headers.set('RateLimit-Policy', `${policy}; q=${limit}; w=${windowSeconds}`)
      reply.headers.set('RateLimit', `${policy}; r=${Math.max(0, limit - current.count)}; t=${Math.max(0, Math.ceil((current.resetAt - Date.now()) / 1000))}`)
      return reply
    }

    if (current.count > limit) {
      const reply = withHeaders(Reply.json({ error: { code: 'rate_limited', message } }, 429))
      reply.headers.set('Retry-After', String(Math.max(0, Math.ceil((current.resetAt - Date.now()) / 1000))))
      return reply
    }

    // A thrown error is always a failed request, so it keeps counting.
    const reply = await next()
    if (onlyFailures && reply.status < 400 && hits.get(key) === current) current.count--
    return withHeaders(reply)
  }
}

/** Signed-in users are limited per account (shared IPs like offices don't block each other); guests per IP. */
const userOrIp = (req: ApiRequest) => (req.user ? `user:${String(req.user._id)}` : `ip:${ipKey(req.ip)}`)

export const rateLimits = {
  api: () => limiter(15 * MINUTE, 300, 'Too many requests. Please slow down.', { keyGenerator: userOrIp }),
  ai: () => limiter(MINUTE, 20, 'Too many AI requests. Please wait a minute.', { keyGenerator: userOrIp }),
  payments: () => limiter(15 * MINUTE, 30, 'Too many payment attempts. Please wait and try again.', { keyGenerator: userOrIp }),
}
