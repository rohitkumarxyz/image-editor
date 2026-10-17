import { ObjectId } from 'mongodb'
import type { UserDoc } from '../../db.ts'
import { AppError } from '../../lib/errors.ts'
import type { CreditsService } from '../credits/credits.service.ts'
import type { AiJobsRepo } from './jobs.repo.ts'
import type { AiProvider, AiWord, DetectInput, ImageEditInput } from './openai.client.ts'

const DRAFT_COUNT = 2
const DAY_MS = 24 * 60 * 60 * 1000

export interface AiLimits {
  editCost: number
  detectDailyLimit: number
  refundDailyLimit: number
  refundWindowMinutes: number
}

export class AiService {
  private readonly provider: AiProvider
  private readonly jobs: AiJobsRepo
  private readonly credits: CreditsService
  private readonly limits: AiLimits

  constructor(provider: AiProvider, jobs: AiJobsRepo, credits: CreditsService, limits: AiLimits) {
    this.provider = provider
    this.jobs = jobs
    this.credits = credits
    this.limits = limits
  }

  async edit(user: UserDoc, input: Omit<ImageEditInput, 'count'>): Promise<{ jobId: string; images: string[]; credits: number }> {
    const jobId = new ObjectId()
    const cost = this.limits.editCost
    const balance = await this.credits.change({ userId: user._id, delta: -cost, reason: 'ai_edit', refId: String(jobId) })
    await this.jobs.create({ _id: jobId, userId: user._id, kind: 'edit', cost })

    let images: string[]
    try {
      const result = await this.provider.editImage({ ...input, count: DRAFT_COUNT })
      images = result.images
      await this.jobs.setProviderCost(jobId, result.costUsd)
    } catch (err) {
      await this.jobs.finish(jobId, 'failed')
      await this.credits.change({ userId: user._id, delta: cost, reason: 'ai_edit_refund', refId: String(jobId) })
      throw err
    }
    await this.jobs.finish(jobId, 'succeeded')
    return { jobId: String(jobId), images, credits: balance! }
  }

  async refund(user: UserDoc, jobId: string): Promise<number> {
    if (!ObjectId.isValid(jobId)) throw new AppError('not_found', 'Edit not found.')
    const now = Date.now()
    const used = await this.jobs.countRefundsSince(user._id, new Date(now - DAY_MS))
    if (used >= this.limits.refundDailyLimit) {
      throw new AppError('limit_reached', 'Daily limit for returned credits reached. Contact support if something is wrong.')
    }

    const job = await this.jobs.claimRefund(new ObjectId(jobId), user._id, new Date(now - this.limits.refundWindowMinutes * 60_000))
    if (!job) throw new AppError('bad_request', 'This edit can no longer be refunded.')
    return (await this.credits.change({ userId: user._id, delta: job.cost, reason: 'ai_edit_refund', refId: jobId }))!
  }

  async detect(user: UserDoc, input: DetectInput): Promise<AiWord[]> {
    const used = await this.jobs.countSince(user._id, 'detect', new Date(Date.now() - DAY_MS))
    if (used >= this.limits.detectDailyLimit) {
      throw new AppError('limit_reached', 'Daily limit for the AI text finder reached. Standard detection still works.')
    }
    const jobId = new ObjectId()
    await this.jobs.create({ _id: jobId, userId: user._id, kind: 'detect', cost: 0 })
    try {
      const words = await this.provider.findWords(input)
      await this.jobs.finish(jobId, 'succeeded')
      return words
    } catch (err) {
      await this.jobs.finish(jobId, 'failed')
      throw err
    }
  }
}
