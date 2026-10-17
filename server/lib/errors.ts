import { logger } from './logger.ts'

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'insufficient_credits'
  | 'limit_reached'
  | 'rate_limited'
  | 'upstream_failed'
  | 'unavailable'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  insufficient_credits: 402,
  limit_reached: 429,
  rate_limited: 429,
  upstream_failed: 502,
  unavailable: 503,
  internal: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = STATUS[code]
  }
}

export function errorBody(err: unknown, request: { method: string; path: string }): { status: number; body: { error: { code: ErrorCode; message: string } } } {
  if (err instanceof AppError) return { status: err.status, body: { error: { code: err.code, message: err.message } } }
  logger.error('unhandled_error', { method: request.method, path: request.path, error: err instanceof Error ? err.stack : String(err) })
  return { status: 500, body: { error: { code: 'internal', message: 'Something went wrong. Please try again.' } } }
}
