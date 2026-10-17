import { z } from 'zod'
import { AppError } from '../../lib/errors.ts'
import { parse } from '../../lib/validate.ts'
import { Reply, post, type Route } from '../../http/router.ts'
import type { AiService } from './ai.service.ts'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_BASE64 = 16 * 1024 * 1024
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const MIN_PIXELS = 655_360
const MAX_PIXELS = 8_294_400
const MAX_EDGE = 3840
const MAX_ASPECT = 3
const SIZE_STEP = 16

const promptText = (max: number) =>
  z
    .string()
    .max(max, `Text is too long (max ${max} characters).`)
    .transform((t) => t.replace(/[\r\n\t"]+/g, ' ').trim())

const outputSize = z.string().refine((s) => {
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(s)
  if (!match) return false
  const w = Number(match[1])
  const h = Number(match[2])
  return (
    w % SIZE_STEP === 0 &&
    h % SIZE_STEP === 0 &&
    Math.max(w, h) <= MAX_EDGE &&
    Math.max(w / h, h / w) <= MAX_ASPECT &&
    w * h >= MIN_PIXELS &&
    w * h <= MAX_PIXELS
  )
}, 'Unsupported image size.')

const pngBase64 = z
  .string()
  .max(MAX_BASE64, 'The image is too large.')
  .regex(BASE64, 'Image must be base64.')
  .transform((s, ctx) => {
    const bytes = Buffer.from(s, 'base64')
    if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      ctx.addIssue({ code: 'custom', message: 'Image must be a PNG.' })
      return z.NEVER
    }
    return bytes
  })

const editBody = z.object({
  image: pngBase64,
  mask: pngBase64,
  size: outputSize,
  oldText: promptText(200),
  newText: promptText(200).refine((t) => t.length > 0, 'Enter the new text.'),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  fontHint: promptText(80).optional(),
})

const detectBody = z.object({
  image: z
    .string()
    .max(MAX_BASE64, 'The image is too large.')
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, 'Image must be a PNG or JPEG data URL.'),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
})

export function aiRoutes(ai: AiService): Route[] {
  return [
    post('/edit', [], async (req) => Reply.json(await ai.edit(req.user!, parse(editBody, req.body)))),

    post('/edit/:jobId/refund', [], async (req) => {
      const jobId = req.params.jobId
      if (typeof jobId !== 'string') throw new AppError('not_found', 'Edit not found.')
      return Reply.json({ credits: await ai.refund(req.user!, jobId) })
    }),

    post('/detect', [], async (req) => Reply.json({ words: await ai.detect(req.user!, parse(detectBody, req.body)) })),
  ]
}
