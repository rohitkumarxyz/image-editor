import type { z } from 'zod'
import { AppError } from './errors.ts'

/** Parses untrusted input; the first problem becomes a 400 with a readable message. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const field = issue.path.join('.')
  throw new AppError('bad_request', field ? `${field}: ${issue.message}` : issue.message)
}
