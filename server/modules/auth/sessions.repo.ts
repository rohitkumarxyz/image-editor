import { ObjectId } from 'mongodb'
import type { Database, SessionDoc } from '../../db.ts'

export class SessionsRepo {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(userId: ObjectId, tokenHash: string, ttlMs: number): Promise<SessionDoc> {
    const now = new Date()
    const session: SessionDoc = { _id: new ObjectId(), tokenHash, userId, createdAt: now, expiresAt: new Date(now.getTime() + ttlMs) }
    await this.db.sessions.insertOne(session)
    return session
  }

  findValid(tokenHash: string): Promise<SessionDoc | null> {
    return this.db.sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.sessions.deleteOne({ tokenHash })
  }

  async deleteAllForUser(userId: ObjectId): Promise<void> {
    await this.db.sessions.deleteMany({ userId })
  }
}
