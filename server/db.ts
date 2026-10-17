import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export interface UserDoc {
  _id: ObjectId
  email: string
  name: string
  passwordHash: string
  /** Mobile number the payment gateway needs; saved at the first purchase. */
  phone?: string
  credits: number
  /**
   * Keys of one-time credit grants already applied (paid orders, sign-up bonus). Checked and updated in the
   * same atomic update as `credits`, so a grant can never be applied twice, even if a request is retried.
   */
  appliedRefs: string[]
  createdAt: Date
}

export interface SessionDoc {
  _id: ObjectId
  /** SHA-256 of the cookie token; the token itself is never stored. */
  tokenHash: string
  userId: ObjectId
  createdAt: Date
  expiresAt: Date
}

export type LedgerReason = 'signup_bonus' | 'purchase' | 'ai_edit' | 'ai_edit_refund'

export interface LedgerDoc {
  _id: ObjectId
  userId: ObjectId
  delta: number
  reason: LedgerReason
  /** Order id or AI job id this change belongs to. */
  refId: string | null
  balanceAfter: number
  createdAt: Date
}

export type OrderStatus = 'created' | 'paid'

/** The order's own `_id` (as a hex string) is also its order id at Cashfree. */
export interface OrderDoc {
  _id: ObjectId
  userId: ObjectId
  packId: string
  credits: number
  amount: number
  currency: string
  paymentId: string | null
  status: OrderStatus
  createdAt: Date
  paidAt: Date | null
}

export type AiJobKind = 'edit' | 'detect'
export type AiJobStatus = 'charged' | 'succeeded' | 'failed' | 'refunded'

export interface AiJobDoc {
  _id: ObjectId
  userId: ObjectId
  kind: AiJobKind
  cost: number
  status: AiJobStatus
  /** What the AI provider charged us, in USD (from token usage); null if unknown. For margin checks. */
  providerCostUsd?: number | null
  createdAt: Date
  finishedAt: Date | null
}

export interface Database {
  client: MongoClient
  users: Collection<UserDoc>
  sessions: Collection<SessionDoc>
  ledger: Collection<LedgerDoc>
  orders: Collection<OrderDoc>
  aiJobs: Collection<AiJobDoc>
}

export async function connectDatabase(uri: string, dbName: string): Promise<Database> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 })
  await client.connect()
  const db = client.db(dbName)
  const database: Database = {
    client,
    users: db.collection<UserDoc>('users'),
    sessions: db.collection<SessionDoc>('sessions'),
    ledger: db.collection<LedgerDoc>('ledger'),
    orders: db.collection<OrderDoc>('orders'),
    aiJobs: db.collection<AiJobDoc>('aiJobs'),
  }
  await ensureIndexes(database)
  return database
}

/** Left over from Razorpay: a unique index on a field new orders don't have would make every second order clash. */
const OBSOLETE_ORDER_INDEX = 'razorpayOrderId_1'

async function ensureIndexes(db: Database): Promise<void> {
  if (await db.orders.indexExists(OBSOLETE_ORDER_INDEX).catch(() => false)) await db.orders.dropIndex(OBSOLETE_ORDER_INDEX)
  await Promise.all([
    db.users.createIndex({ email: 1 }, { unique: true }),
    db.sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    // MongoDB deletes expired sessions by itself.
    db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.ledger.createIndex({ userId: 1, createdAt: -1 }),
    db.orders.createIndex({ userId: 1, createdAt: -1 }),
    db.aiJobs.createIndex({ userId: 1, kind: 1, createdAt: -1 }),
  ])
}
