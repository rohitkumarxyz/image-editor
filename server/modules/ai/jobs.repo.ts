import { ObjectId } from 'mongodb'
import type { AiJobDoc, AiJobKind, AiJobStatus, Database } from '../../db.ts'

export class AiJobsRepo {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(input: { _id: ObjectId; userId: ObjectId; kind: AiJobKind; cost: number }): Promise<AiJobDoc> {
    const job: AiJobDoc = { ...input, status: 'charged', createdAt: new Date(), finishedAt: null }
    await this.db.aiJobs.insertOne(job)
    return job
  }

  async setProviderCost(id: ObjectId, costUsd: number | null): Promise<void> {
    await this.db.aiJobs.updateOne({ _id: id }, { $set: { providerCostUsd: costUsd } })
  }

  async finish(id: ObjectId, status: AiJobStatus): Promise<void> {
    await this.db.aiJobs.updateOne({ _id: id }, { $set: { status, finishedAt: new Date() } })
  }

  countSince(userId: ObjectId, kind: AiJobKind, since: Date): Promise<number> {
    return this.db.aiJobs.countDocuments({ userId, kind, createdAt: { $gte: since } })
  }

  countRefundsSince(userId: ObjectId, since: Date): Promise<number> {
    return this.db.aiJobs.countDocuments({ userId, kind: 'edit', status: 'refunded', finishedAt: { $gte: since } })
  }

  /** Atomically moves one of the user's recent successful edits to "refunded"; null if it isn't eligible. */
  claimRefund(id: ObjectId, userId: ObjectId, createdAfter: Date): Promise<AiJobDoc | null> {
    return this.db.aiJobs.findOneAndUpdate(
      { _id: id, userId, kind: 'edit', status: 'succeeded', createdAt: { $gte: createdAfter } },
      { $set: { status: 'refunded', finishedAt: new Date() } },
      { returnDocument: 'after' },
    )
  }
}
