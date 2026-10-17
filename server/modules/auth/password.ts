import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_BYTES = 16
const PARAMS = { N: 2 ** 15, r: 8, p: 1 }
// scrypt needs 128 * N * r bytes; give it headroom above Node's 32 MB default.
const MAX_MEMORY = 64 * 1024 * 1024

function derive(password: string, salt: Buffer, params: typeof PARAMS): Promise<Buffer> {
  const options: ScryptOptions = { ...params, maxmem: MAX_MEMORY }
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

/** Stored as `scrypt$N$r$p$salt$hash`, so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}
