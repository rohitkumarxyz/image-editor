import { MongoClient, type Collection, type ObjectId } from 'mongodb'

export interface UserDoc {
  _id: ObjectId
  email: string
  name: string
  googleId?: string
  phone?: string
  credits: number
  appliedRefs: string[]
  createdAt: Date
}

export interface SessionDoc {
  _id: ObjectId
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
  refId: string | null
  balanceAfter: number
  createdAt: Date
}

export type OrderStatus = 'created' | 'paid'

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

const OBSOLETE_ORDER_INDEX = 'razorpayOrderId_1'

async function ensureIndexes(db: Database): Promise<void> {
  if (await db.orders.indexExists(OBSOLETE_ORDER_INDEX).catch(() => false)) await db.orders.dropIndex(OBSOLETE_ORDER_INDEX)
  await Promise.all([
    db.users.createIndex({ email: 1 }, { unique: true }),
    db.sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.ledger.createIndex({ userId: 1, createdAt: -1 }),
    db.orders.createIndex({ userId: 1, createdAt: -1 }),
    db.aiJobs.createIndex({ userId: 1, kind: 1, createdAt: -1 }),
  ])
}
