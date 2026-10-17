import { AppError } from '../lib/errors.ts'

const tooLarge = () => new AppError('payload_too_large', 'The image is too large.')

export function isJson(request: Request): boolean {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  return type === 'application/json' || (type.startsWith('application/') && type.endsWith('+json'))
}

export async function readRaw(request: Request, limit: number): Promise<Buffer> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) throw tooLarge()
  if (!request.body) return Buffer.alloc(0)

  const chunks: Uint8Array[] = []
  let size = 0
  const reader = request.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function readJson(request: Request, limit: number): Promise<unknown> {
  const text = (await readRaw(request, limit)).toString('utf8')
  if (text.length === 0) return {}
  const first = text.trimStart()[0]
  if (first !== '{' && first !== '[') throw new AppError('bad_request', 'The request body is not valid JSON.')
  try {
    return JSON.parse(text)
  } catch {
    throw new AppError('bad_request', 'The request body is not valid JSON.')
  }
}
