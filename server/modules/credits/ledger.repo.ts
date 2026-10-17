import { ObjectId } from 'mongodb'
import type { Database, LedgerDoc, LedgerReason } from '../../db.ts'

export class LedgerRepo {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async add(entry: { userId: ObjectId; delta: number; reason: LedgerReason; refId: string | null; balanceAfter: number }): Promise<void> {
    await this.db.ledger.insertOne({ _id: new ObjectId(), ...entry, createdAt: new Date() })
  }

  listForUser(userId: ObjectId, limit: number): Promise<LedgerDoc[]> {
    return this.db.ledger.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
  }
}
