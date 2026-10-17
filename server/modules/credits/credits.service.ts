import type { ObjectId } from 'mongodb'
import type { Database, LedgerReason } from '../../db.ts'
import { AppError } from '../../lib/errors.ts'
import { logger } from '../../lib/logger.ts'
import type { LedgerRepo } from './ledger.repo.ts'

const HISTORY_LIMIT = 100

export interface CreditChange {
  userId: ObjectId
  delta: number
  reason: LedgerReason
  refId: string | null
  onceKey?: string
}

export class CreditsService {
  private readonly db: Database
  private readonly ledger: LedgerRepo

  constructor(db: Database, ledger: LedgerRepo) {
    this.db = db
    this.ledger = ledger
  }

  async change({ userId, delta, reason, refId, onceKey }: CreditChange): Promise<number | null> {
    const filter: Record<string, unknown> = { _id: userId }
    if (delta < 0) filter.credits = { $gte: -delta }
    if (onceKey) filter.appliedRefs = { $ne: onceKey }

    const update = onceKey ? { $inc: { credits: delta }, $push: { appliedRefs: onceKey } } : { $inc: { credits: delta } }
    const user = await this.db.users.findOneAndUpdate(filter, update, { returnDocument: 'after', projection: { credits: 1 } })

    if (!user) {
      if (onceKey) return null
      if (delta < 0) throw new AppError('insufficient_credits', 'Not enough credits. Buy more to continue.')
      throw new AppError('not_found', 'Account not found.')
    }

    await this.ledger.add({ userId, delta, reason, refId, balanceAfter: user.credits }).catch((err: unknown) =>
      logger.error('ledger_write_failed', { userId: String(userId), delta, reason, refId, error: String(err) }),
    )
    return user.credits
  }

  async balance(userId: ObjectId): Promise<number> {
    const user = await this.db.users.findOne({ _id: userId }, { projection: { credits: 1 } })
    return user?.credits ?? 0
  }

  async history(userId: ObjectId) {
    const rows = await this.ledger.listForUser(userId, HISTORY_LIMIT)
    return rows.map((r) => ({ id: String(r._id), delta: r.delta, reason: r.reason, balanceAfter: r.balanceAfter, createdAt: r.createdAt }))
  }
}
