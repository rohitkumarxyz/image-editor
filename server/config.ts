import { z } from 'zod'

const packSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  credits: z.number().int().positive(),
  /** Price in the smallest currency unit (paise for INR). */
  amount: z.number().int().positive(),
})

export type CreditPack = z.infer<typeof packSchema>

/**
 * One AI edit measured at about $0.04 for a text line and up to ~$0.15 for large areas (2026-10-08), so even
 * the cheapest per-edit price keeps a margin on big edits.
 */
const DEFAULT_PACKS: CreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 10, amount: 19900 },
  { id: 'pro', name: 'Pro', credits: 50, amount: 79900 },
  { id: 'studio', name: 'Studio', credits: 200, amount: 249900 },
]

const DEV_DEFAULTS = {
  SUPPORT_EMAIL: 'support@example.com',
  APP_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017',
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  /** Public URL of the app, e.g. https://edit.example.com — used for the CSRF origin check. */
  APP_ORIGIN: z.url(),
  /** Number of reverse proxies in front of the app (1 on Render/Railway/Fly), so rate limits see real client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().min(1).default('image_editor'),

  OPENAI_API_KEY: z.string().min(20),
  /** OAuth client id from Google Cloud Console; public, it is sent to the browser for the sign-in button. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  OPENAI_EDIT_MODEL: z.string().default('gpt-image-2.5-sunburst'),
  OPENAI_VISION_MODEL: z.string().default('gpt-6.1-sol'),

  /** Payments stay switched off until both Cashfree values are set. The secret key also signs webhooks. */
  CASHFREE_APP_ID: z.string().min(1).optional(),
  CASHFREE_SECRET_KEY: z.string().min(1).optional(),
  /** `sandbox` for test payments, `production` for real money. Sandbox keys only work with `sandbox`. */
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  BUSINESS_NAME: z.string().min(1).default('Image Text Editor'),
  /** Shown on the contact page and footer; payment gateways require visible contact details. */
  SUPPORT_EMAIL: z.email(),
  CURRENCY: z.string().length(3).default('INR'),

  SIGNUP_FREE_CREDITS: z.coerce.number().int().min(0).default(3),
  AI_EDIT_COST: z.coerce.number().int().positive().default(1),
  AI_DETECT_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
  REFUND_DAILY_LIMIT: z.coerce.number().int().min(0).default(5),
  REFUND_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  /** Optional JSON array overriding the credit packs, e.g. [{"id":"starter","name":"Starter","credits":10,"amount":9900}] */
  CREDIT_PACKS: z.string().optional(),
})

export type CashfreeMode = 'sandbox' | 'production'

export interface CashfreeKeys {
  appId: string
  secretKey: string
  mode: CashfreeMode
}

export type Config = Omit<z.infer<typeof envSchema>, 'CREDIT_PACKS' | 'CASHFREE_APP_ID' | 'CASHFREE_SECRET_KEY' | 'CASHFREE_ENV'> & {
  packs: CreditPack[]
  cashfree: CashfreeKeys | null
  isProduction: boolean
}

/** Reads and checks all settings once at boot; a missing or malformed value stops the server with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProduction = env.NODE_ENV === 'production'
  // Local development works with just OPENAI_API_KEY; production must set everything explicitly.
  const withDevDefaults = isProduction ? env : { ...DEV_DEFAULTS, ...env }
  const parsed = envSchema.safeParse(withDevDefaults)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid server configuration:\n${problems}`)
  }
  const { CREDIT_PACKS, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV, ...rest } = parsed.data
  const packs = CREDIT_PACKS ? z.array(packSchema).min(1).parse(JSON.parse(CREDIT_PACKS)) : DEFAULT_PACKS
  const cashfree = CASHFREE_APP_ID && CASHFREE_SECRET_KEY ? { appId: CASHFREE_APP_ID, secretKey: CASHFREE_SECRET_KEY, mode: CASHFREE_ENV } : null
  if (isProduction && !rest.APP_ORIGIN.startsWith('https://')) {
    throw new Error('Invalid server configuration:\n  - APP_ORIGIN: must use https:// in production (secure cookies need it)')
  }
  return { ...rest, packs, cashfree, isProduction }
}
