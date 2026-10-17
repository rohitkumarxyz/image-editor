import type { Config } from './config.ts'
import type { Database } from './db.ts'
import { isJson, readJson, readRaw } from './http/body.ts'
import { parseCookies, sessionCookie, type SessionCookie } from './http/cookies.ts'
import { rateLimits } from './http/rateLimits.ts'
import { Reply, dispatchMount, dispatchRoutes, get, post, requireUser, run, type ApiRequest, type Middleware, type Mount, type Next } from './http/router.ts'
import { clientIp, requireSameOrigin, securityHeaders } from './http/security.ts'
import { AppError, errorBody } from './lib/errors.ts'
import { aiRoutes } from './modules/ai/ai.routes.ts'
import { AiService } from './modules/ai/ai.service.ts'
import { AiJobsRepo } from './modules/ai/jobs.repo.ts'
import { OpenAiProvider, type AiProvider } from './modules/ai/openai.client.ts'
import { authRoutes } from './modules/auth/auth.routes.ts'
import { AuthService } from './modules/auth/auth.service.ts'
import { GoogleIdTokenVerifier, type GoogleVerifier } from './modules/auth/google.client.ts'
import { SessionsRepo } from './modules/auth/sessions.repo.ts'
import { UsersRepo } from './modules/auth/users.repo.ts'
import { creditsRoutes } from './modules/credits/credits.routes.ts'
import { CreditsService } from './modules/credits/credits.service.ts'
import { LedgerRepo } from './modules/credits/ledger.repo.ts'
import { OrdersRepo } from './modules/payments/orders.repo.ts'
import { paymentsRoutes, paymentsWebhook } from './modules/payments/payments.routes.ts'
import { PaymentsService } from './modules/payments/payments.service.ts'
import { CashfreeGateway, type PaymentGateway } from './modules/payments/cashfree.client.ts'

const KB = 1024
const JSON_LIMIT = 100 * KB
/** AI requests carry the image crop and mask as base64. */
const AI_JSON_LIMIT = 25 * KB * KB
const WEBHOOK_LIMIT = KB * KB
const WEBHOOK_PATH = '/api/payments/webhook'

export interface ApiDeps {
  config: Config
  db: Database
  /** Overridable for tests. */
  aiProvider?: AiProvider
  paymentGateway?: PaymentGateway | null
  googleVerifier?: GoogleVerifier
}

/** Handles every `/api/*` request: a web `Request` in, a web `Response` out. */
export type ApiHandler = (request: Request) => Promise<Response>

/** Loads the signed-in user (if any) onto `req.user`. Never rejects; `requireUser` does that. */
function loadSession(auth: AuthService, cookie: SessionCookie): Middleware {
  return async (req, next) => {
    const token = req.cookies[cookie.name]
    if (typeof token === 'string' && token.length > 0 && token.length <= 128) {
      const user = await auth.userForToken(token)
      if (user) {
        req.user = user
        req.sessionToken = token
      }
    }
    return next()
  }
}

const isWithin = (path: string, prefix: string) => {
  const lower = path.toLowerCase()
  return lower === prefix || lower.startsWith(`${prefix}/`)
}

export function createApi({ config, db, aiProvider, paymentGateway, googleVerifier }: ApiDeps): ApiHandler {
  const credits = new CreditsService(db, new LedgerRepo(db))
  const users = new UsersRepo(db)
  const auth = new AuthService(users, new SessionsRepo(db), credits, googleVerifier ?? new GoogleIdTokenVerifier(config.GOOGLE_CLIENT_ID), config.SIGNUP_FREE_CREDITS)
  const payments = new PaymentsService(
    paymentGateway !== undefined
      ? paymentGateway
      : config.cashfree && new CashfreeGateway(config.cashfree.appId, config.cashfree.secretKey, config.cashfree.mode),
    new OrdersRepo(db),
    users,
    credits,
    { packs: config.packs, currency: config.CURRENCY, appOrigin: config.APP_ORIGIN },
  )
  const ai = new AiService(aiProvider ?? new OpenAiProvider(config.OPENAI_API_KEY, config.OPENAI_EDIT_MODEL, config.OPENAI_VISION_MODEL), new AiJobsRepo(db), credits, {
    editCost: config.AI_EDIT_COST,
    detectDailyLimit: config.AI_DETECT_DAILY_LIMIT,
    refundDailyLimit: config.REFUND_DAILY_LIMIT,
    refundWindowMinutes: config.REFUND_WINDOW_MINUTES,
  })
  const cookie = sessionCookie(config.isProduction)
  const headers = securityHeaders({ isProduction: config.isProduction })

  const publicRoutes = [
    get('/api/health', [], async () => {
      await db.client.db('admin').command({ ping: 1 })
      return Reply.json({ ok: true })
    }),
    /** Public settings the UI shows (prices come from /payments/packs). */
    get('/api/config', [], () =>
      Reply.json({
        aiEditCost: config.AI_EDIT_COST,
        signupCredits: config.SIGNUP_FREE_CREDITS,
        paymentsEnabled: payments.enabled,
        businessName: config.BUSINESS_NAME,
        supportEmail: config.SUPPORT_EMAIL,
        googleClientId: config.GOOGLE_CLIENT_ID,
      }),
    ),
  ]
  // Signature-verified server-to-server call: no cookies, no Origin, raw body.
  const webhookRoutes = [post('/', [], (req) => paymentsWebhook(payments, req))]

  // Each group has its own limiter instance, as before.
  const mounts: Mount[] = [
    {
      prefix: '/api/auth',
      middleware: [rateLimits.api()],
      routes: authRoutes(auth, cookie),
    },
    { prefix: '/api/credits', middleware: [rateLimits.api()], routes: creditsRoutes(credits) },
    { prefix: '/api/payments', middleware: [rateLimits.payments()], routes: paymentsRoutes(payments) },
    { prefix: '/api/ai', middleware: [rateLimits.ai(), requireUser], routes: aiRoutes(ai) },
  ]
  const csrf = requireSameOrigin(config.APP_ORIGIN)
  const notFound: Next = async () => {
    throw new AppError('not_found', 'Not found.')
  }

  async function dispatch(req: ApiRequest, request: Request): Promise<Reply> {
    const open = dispatchRoutes(req, publicRoutes, req.path)
    if (open) return open

    if (isWithin(req.path, WEBHOOK_PATH)) {
      const rest = req.path.slice(WEBHOOK_PATH.length) || '/'
      if (req.method === 'POST' && isJson(request)) req.rawBody = await readRaw(request, WEBHOOK_LIMIT)
      const hook = dispatchRoutes(req, webhookRoutes, rest)
      if (hook) return hook
    }

    return run(req, [csrf], async () => {
      if (isJson(request)) req.body = await readJson(request, isWithin(req.path, '/api/ai') ? AI_JSON_LIMIT : JSON_LIMIT)
      req.cookies = parseCookies(request.headers.get('cookie'))
      return run(req, [loadSession(auth, cookie)], async () => {
        for (const mount of mounts) {
          const reply = dispatchMount(req, mount, notFound)
          if (reply) return reply
        }
        return notFound()
      })
    })
  }

  return async (request) => {
    const req: ApiRequest = {
      method: request.method.toUpperCase(),
      path: new URL(request.url).pathname,
      headers: request.headers,
      ip: clientIp(request.headers.get('x-forwarded-for'), config.TRUST_PROXY),
      body: undefined,
      cookies: {},
      params: {},
    }
    let reply: Reply
    try {
      reply = await dispatch(req, request)
    } catch (err) {
      const { status, body } = errorBody(err, req)
      reply = Reply.json(body, status)
    }

    const responseHeaders = new Headers(headers)
    reply.headers.forEach((value, key) => {
      if (key !== 'set-cookie') responseHeaders.set(key, value)
    })
    for (const value of reply.headers.getSetCookie()) responseHeaders.append('Set-Cookie', value)
    if (reply.body === undefined) return new Response(null, { status: reply.status, headers: responseHeaders })
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
    return new Response(req.method === 'HEAD' ? null : JSON.stringify(reply.body), { status: reply.status, headers: responseHeaders })
  }
}
