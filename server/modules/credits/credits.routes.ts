import { Reply, get, requireUser, type Route } from '../../http/router.ts'
import type { CreditsService } from './credits.service.ts'

export function creditsRoutes(credits: CreditsService): Route[] {
  return [get('/history', [requireUser], async (req) => Reply.json({ entries: await credits.history(req.user!._id) }))]
}
