export type ApiErrorCode =
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
  | 'network'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function api<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST')
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('network', 'No connection to the server. Check your internet and try again.', 0)
  }
  if (response.status === 204) return undefined as T
  const json = (await response.json().catch(() => null)) as (T & { error?: { code: ApiErrorCode; message: string } }) | null
  if (!response.ok) {
    throw new ApiError(json?.error?.code ?? 'internal', json?.error?.message ?? 'Something went wrong. Please try again.', response.status)
  }
  return json as T
}
