import { z } from 'zod'
import { AppError } from '../../lib/errors.ts'
import { parse } from '../../lib/validate.ts'
import { Reply, get, post, requireUser, type ApiRequest, type Route } from '../../http/router.ts'
import type { PaymentsService } from './payments.service.ts'

/** Indian 10-digit mobile, or an international number with "+". Spaces, dashes and a +91 prefix are accepted. */
const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .transform((s) => (/^\+91\d{10}$/.test(s) ? s.slice(3) : s))
  .pipe(z.string().regex(/^(\d{10}|\+\d{10,15})$/, 'Enter a valid mobile number.'))

const orderBody = z.object({ packId: z.string().min(1).max(40), phone })
const confirmBody = z.object({ orderId: z.string().min(1).max(64) })

export function paymentsRoutes(payments: PaymentsService): Route[] {
  return [
    get('/packs', [], () => Reply.json({ packs: payments.listPacks(), enabled: payments.enabled })),

    post('/orders', [requireUser], async (req) => Reply.json({ checkout: await payments.startCheckout(req.user!, parse(orderBody, req.body)) }, 201)),

    post('/confirm', [requireUser], async (req) => {
      const { orderId } = parse(confirmBody, req.body)
      return Reply.json({ credits: await payments.confirm(req.user!, orderId) })
    }),
  ]
}

/** Runs before the JSON parser and the CSRF check: the signature is computed over the exact raw bytes. */
export async function paymentsWebhook(payments: PaymentsService, req: ApiRequest): Promise<Reply> {
  const signature = req.headers.get('x-webhook-signature')
  const timestamp = req.headers.get('x-webhook-timestamp')
  if (!signature || !timestamp || !req.rawBody) throw new AppError('bad_request', 'Missing signature.')
  await payments.handleWebhook(req.rawBody, timestamp, signature)
  return Reply.json({ ok: true })
}
