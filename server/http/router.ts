import type { UserDoc } from '../db.ts'
import { AppError } from '../lib/errors.ts'
import type { SessionCookie } from './cookies.ts'
import { serializeCookie } from './cookies.ts'

export interface ApiRequest {
  method: string
  path: string
  headers: Headers
  ip: string
  body: unknown
  rawBody?: Buffer
  cookies: Record<string, string>
  params: Record<string, string>
  user?: UserDoc
  sessionToken?: string
}

export class Reply {
  readonly status: number
  readonly body: unknown
  readonly headers = new Headers()

  constructor(status: number, body?: unknown) {
    this.status = status
    this.body = body
  }

  static json(body: unknown, status = 200): Reply {
    return new Reply(status, body)
  }

  static empty(status = 204): Reply {
    return new Reply(status)
  }

  setCookie(cookie: SessionCookie, value: string): this {
    this.headers.append('Set-Cookie', serializeCookie(cookie.name, value, cookie.options))
    return this
  }

  clearCookie(cookie: SessionCookie): this {
    this.headers.append('Set-Cookie', serializeCookie(cookie.name, '', { ...cookie.options, maxAge: undefined, expires: new Date(0) }))
    return this
  }
}

export type Next = () => Promise<Reply>
export type Middleware = (req: ApiRequest, next: Next) => Promise<Reply>
export type Handler = (req: ApiRequest) => Promise<Reply> | Reply

export interface Route {
  method: 'GET' | 'POST'
  pattern: RegExp
  keys: string[]
  middleware: Middleware[]
  handler: Handler
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = []
  const source = path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      keys.push(segment.slice(1))
      return '([^/]+?)'
    })
    .join('/')
  return { pattern: new RegExp(`^${source}/?$`, 'i'), keys }
}

function route(method: Route['method'], path: string, middleware: Middleware[], handler: Handler): Route {
  return { method, ...compile(path), middleware, handler }
}

export const get = (path: string, middleware: Middleware[], handler: Handler) => route('GET', path, middleware, handler)
export const post = (path: string, middleware: Middleware[], handler: Handler) => route('POST', path, middleware, handler)

export interface Mount {
  prefix: string
  middleware: Middleware[]
  routes: Route[]
}

export function run(req: ApiRequest, middleware: Middleware[], last: Next): Promise<Reply> {
  const step = (i: number): Promise<Reply> => (i < middleware.length ? middleware[i](req, () => step(i + 1)) : last())
  return step(0)
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new AppError('bad_request', 'Invalid URL.')
  }
}

export function dispatchRoutes(req: ApiRequest, routes: Route[], path: string): Promise<Reply> | null {
  const method = req.method === 'HEAD' ? 'GET' : req.method
  for (const r of routes) {
    if (r.method !== method) continue
    const match = r.pattern.exec(path)
    if (!match) continue
    req.params = Object.fromEntries(r.keys.map((key, i) => [key, decodeParam(match[i + 1])]))
    return run(req, r.middleware, async () => r.handler(req))
  }
  return null
}

export function dispatchMount(req: ApiRequest, mount: Mount, notFound: Next): Promise<Reply> | null {
  const lower = req.path.toLowerCase()
  const prefix = mount.prefix.toLowerCase()
  if (lower !== prefix && !lower.startsWith(`${prefix}/`)) return null
  const rest = req.path.slice(mount.prefix.length) || '/'
  return run(req, mount.middleware, () => dispatchRoutes(req, mount.routes, rest) ?? notFound())
}

export const requireUser: Middleware = async (req, next) => {
  if (!req.user) throw new AppError('unauthorized', 'Please sign in to continue.')
  return next()
}
