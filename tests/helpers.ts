import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { createApi, type ApiHandler } from '../server/api.ts'
import { loadConfig } from '../server/config.ts'
import { connectDatabase, type Database } from '../server/db.ts'
import { AppError } from '../server/lib/errors.ts'
import { hmacSha256Base64 } from '../server/lib/crypto.ts'
import type { AiProvider, AiWord, ImageEditResult } from '../server/modules/ai/openai.client.ts'
import type { GoogleProfile, GoogleVerifier } from '../server/modules/auth/google.client.ts'
import type { CreateOrderInput, PaidPayment, PaymentGateway } from '../server/modules/payments/cashfree.client.ts'

export const ORIGIN = 'http://localhost:5173'
export const SECRET_KEY = 'test_cashfree_secret'
export const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')

export class FakeAi implements AiProvider {
  failNext = false
  calls = 0

  async editImage(): Promise<ImageEditResult> {
    this.calls++
    if (this.failNext) {
      this.failNext = false
      const { AppError } = await import('../server/lib/errors.ts')
      throw new AppError('upstream_failed', 'fake failure')
    }
    return { images: ['draft-a', 'draft-b'], costUsd: 0.25 }
  }

  async findWords(): Promise<AiWord[]> {
    return [{ text: 'Hello', x0: 1, y0: 2, x1: 30, y1: 12 }]
  }
}

export class FakeGateway implements PaymentGateway {
  readonly mode = 'sandbox' as const
  readonly created: CreateOrderInput[] = []
  private readonly paid = new Map<string, PaidPayment>()

  pay(orderId: string, amount: number, paymentId = `cf_pay_${orderId}`): void {
    this.paid.set(orderId, { paymentId, amount })
  }

  async createOrder(input: CreateOrderInput): Promise<{ paymentSessionId: string }> {
    this.created.push(input)
    return { paymentSessionId: `session_${input.orderId}` }
  }

  async findPaidPayment(orderId: string): Promise<PaidPayment | null> {
    return this.paid.get(orderId) ?? null
  }

  verifyWebhook(rawBody: Buffer, timestamp: string, signature: string): boolean {
    return hmacSha256Base64(SECRET_KEY, timestamp + rawBody.toString('utf8')) === signature
  }
}

export class FakeGoogle implements GoogleVerifier {
  async verify(credential: string): Promise<GoogleProfile> {
    const [prefix, email, name] = credential.split(':')
    if (prefix !== 'google' || !email) throw new AppError('unauthorized', 'Google sign-in failed. Please try again.')
    return { googleId: `g-${email.toLowerCase()}`, email: email.toLowerCase(), name: name || 'Test' }
  }
}

export const googleCredential = (email: string, name = 'Test') => `google:${email}:${name}`

export interface TestServer {
  url: string
  db: Database
  ai: FakeAi
  gateway: FakeGateway
  close: () => Promise<void>
}

function serve(api: ApiHandler): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
      else if (value !== undefined) headers.set(key, value)
    }
    if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? '')
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
      duplex: 'half',
    } as RequestInit)
    const response = await api(request)
    const setCookies = response.headers.getSetCookie()
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') res.setHeader(key, value)
    })
    if (setCookies.length) res.setHeader('Set-Cookie', setCookies)
    res.statusCode = response.status
    res.end(Buffer.from(await response.arrayBuffer()))
  })
}

export async function startTestServer(overrides: Record<string, string> = {}): Promise<TestServer> {
  const dbName = `image_editor_test_${process.pid}_${Date.now()}`
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: ORIGIN,
    MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    MONGODB_DB: dbName,
    OPENAI_API_KEY: 'sk-test-not-used-0000000000',
    SUPPORT_EMAIL: 'support@example.com',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    ...overrides,
  })
  const db = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB)
  const ai = new FakeAi()
  const gateway = new FakeGateway()
  const server = serve(createApi({ config, db, aiProvider: ai, paymentGateway: gateway, googleVerifier: new FakeGoogle() }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    db,
    ai,
    gateway,
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      await db.client.db(dbName).dropDatabase()
      await db.client.close()
    },
  }
}

export class Client {
  private cookie = ''
  private readonly base: string

  constructor(base: string) {
    this.base = base
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(this.base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { Origin: ORIGIN } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) this.cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0]
    const text = await response.text()
    return { status: response.status, json: text ? JSON.parse(text) : null, headers: response.headers }
  }

  post(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request('POST', path, body ?? {}, headers)
  }

  get(path: string) {
    return this.request('GET', path)
  }
}

let emailCounter = 0
export async function signedInClient(server: TestServer): Promise<Client> {
  const client = new Client(server.url)
  emailCounter++
  const res = await client.post('/api/auth/google', { credential: googleCredential(`user${emailCounter}_${Date.now()}@example.com`) })
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.json)}`)
  return client
}

export function editBody(newText = 'Days') {
  return { image: PNG_BASE64, mask: PNG_BASE64, size: '1024x1024', oldText: 'Things', newText }
}
