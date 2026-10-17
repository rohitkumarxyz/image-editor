import { createPublicKey, verify, type JsonWebKey } from 'node:crypto'
import { AppError } from '../../lib/errors.ts'
import { logger } from '../../lib/logger.ts'

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const FETCH_TIMEOUT_MS = 10_000
const DEFAULT_KEYS_TTL_MS = 60 * 60 * 1000
const CLOCK_SKEW_S = 60

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
}

/** The Google sign-in check as the auth service sees it; tests swap in a fake. */
export interface GoogleVerifier {
  verify(credential: string): Promise<GoogleProfile>
}

interface IdTokenClaims {
  iss?: string
  aud?: string
  sub?: string
  exp?: number
  email?: string
  email_verified?: boolean
  name?: string
}

const INVALID = 'Google sign-in failed. Please try again.'

const decodePart = <T>(part: string): T => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T

/** Checks a Google ID token (the `credential` from the Google button) against Google's public keys. */
export class GoogleIdTokenVerifier implements GoogleVerifier {
  private readonly clientId: string
  private keys: Map<string, JsonWebKey> = new Map()
  private keysExpireAt = 0

  constructor(clientId: string) {
    this.clientId = clientId
  }

  async verify(credential: string): Promise<GoogleProfile> {
    const parts = credential.split('.')
    if (parts.length !== 3) throw new AppError('unauthorized', INVALID)
    const [headerPart, payloadPart, signaturePart] = parts

    let header: { alg?: string; kid?: string }
    let claims: IdTokenClaims
    try {
      header = decodePart(headerPart)
      claims = decodePart(payloadPart)
    } catch {
      throw new AppError('unauthorized', INVALID)
    }
    if (header.alg !== 'RS256' || !header.kid) throw new AppError('unauthorized', INVALID)

    const jwk = await this.key(header.kid)
    const signed = verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signaturePart, 'base64url'))
    if (!signed) throw new AppError('unauthorized', INVALID)

    const now = Math.floor(Date.now() / 1000)
    if (!claims.iss || !ISSUERS.has(claims.iss) || claims.aud !== this.clientId || !claims.exp || claims.exp + CLOCK_SKEW_S < now) {
      throw new AppError('unauthorized', INVALID)
    }
    if (!claims.sub || !claims.email || claims.email_verified !== true) {
      throw new AppError('unauthorized', 'Your Google account email is not verified.')
    }
    const email = claims.email.toLowerCase()
    return { googleId: claims.sub, email, name: (claims.name ?? email.split('@')[0]).slice(0, 80) }
  }

  private async key(kid: string): Promise<JsonWebKey> {
    // Google rotates keys; an unknown kid also triggers a refresh.
    if (Date.now() >= this.keysExpireAt || !this.keys.has(kid)) await this.refreshKeys()
    const jwk = this.keys.get(kid)
    if (!jwk) throw new AppError('unauthorized', INVALID)
    return jwk
  }

  private async refreshKeys(): Promise<void> {
    const response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch((err: unknown) => {
      logger.error('google_certs_unreachable', { error: String(err) })
      throw new AppError('upstream_failed', INVALID)
    })
    const json = (await response.json().catch(() => null)) as { keys?: (JsonWebKey & { kid?: string })[] } | null
    if (!response.ok || !json?.keys) {
      logger.error('google_certs_failed', { status: response.status })
      throw new AppError('upstream_failed', INVALID)
    }
    this.keys = new Map(json.keys.filter((k) => k.kid).map((k) => [k.kid!, k]))
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')
    this.keysExpireAt = Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_KEYS_TTL_MS)
  }
}
