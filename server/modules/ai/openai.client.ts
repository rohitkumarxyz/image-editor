import { AppError } from '../../lib/errors.ts'
import { logger } from '../../lib/logger.ts'
import { detectPrompt, editPrompt } from './prompts.ts'

const EDITS_URL = 'https://api.openai.com/v1/images/edits'
const RESPONSES_URL = 'https://api.openai.com/v1/responses'
const EDIT_QUALITY = 'high'
const EDIT_TIMEOUT_MS = 180_000
const DETECT_TIMEOUT_MS = 120_000
const IMAGE_PRICE_PER_M = { textInput: 5, imageInput: 8, output: 30 }

export interface ImageEditInput {
  image: Buffer
  mask: Buffer
  size: string
  oldText: string
  newText: string
  color?: string
  fontHint?: string
  count: number
}

export interface ImageEditResult {
  images: string[]
  costUsd: number | null
}

interface ImageUsage {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { text_tokens?: number; image_tokens?: number }
}

function imageCostUsd(usage: ImageUsage | undefined): number | null {
  if (!usage?.output_tokens) return null
  const text = usage.input_tokens_details?.text_tokens ?? 0
  const image = usage.input_tokens_details?.image_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - text)
  const usd = (text * IMAGE_PRICE_PER_M.textInput + image * IMAGE_PRICE_PER_M.imageInput + usage.output_tokens * IMAGE_PRICE_PER_M.output) / 1_000_000
  return Math.round(usd * 10_000) / 10_000
}

export interface DetectInput {
  image: string
  width: number
  height: number
}

export interface AiWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface AiProvider {
  editImage(input: ImageEditInput): Promise<ImageEditResult>
  findWords(input: DetectInput): Promise<AiWord[]>
}

const WORDS_SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          x0: { type: 'number' },
          y0: { type: 'number' },
          x1: { type: 'number' },
          y1: { type: 'number' },
        },
        required: ['text', 'x0', 'y0', 'x1', 'y1'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
}

interface ResponsesOutput {
  output?: { content?: { type?: string; text?: string; refusal?: string }[] }[]
  error?: { message?: string }
}

const EDIT_FAILED = 'The AI edit failed. Your credit was returned; please try again.'
const DETECT_FAILED = 'The AI text finder failed. Please try again.'

function upstreamFailure(event: string, detail: Record<string, unknown>, message: string): AppError {
  logger.error(event, detail)
  return new AppError('upstream_failed', message)
}

export class OpenAiProvider implements AiProvider {
  private readonly apiKey: string
  private readonly editModel: string
  private readonly visionModel: string

  constructor(apiKey: string, editModel: string, visionModel: string) {
    this.apiKey = apiKey
    this.editModel = editModel
    this.visionModel = visionModel
  }

  async editImage(input: ImageEditInput): Promise<ImageEditResult> {
    const form = new FormData()
    form.append('model', this.editModel)
    form.append('image', new Blob([new Uint8Array(input.image)], { type: 'image/png' }), 'image.png')
    form.append('mask', new Blob([new Uint8Array(input.mask)], { type: 'image/png' }), 'mask.png')
    form.append('prompt', editPrompt(input.oldText, input.newText, input.color, input.fontHint))
    form.append('size', input.size)
    form.append('quality', EDIT_QUALITY)
    form.append('n', String(input.count))

    const response = await fetch(EDITS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(EDIT_TIMEOUT_MS),
    }).catch((err: unknown) => {
      throw upstreamFailure('openai_edit_unreachable', { error: String(err) }, EDIT_FAILED)
    })
    const json = (await response.json().catch(() => null)) as
      | { data?: { b64_json?: string }[]; usage?: ImageUsage; error?: { message?: string } }
      | null
    if (!response.ok) throw upstreamFailure('openai_edit_failed', { status: response.status, error: json?.error?.message }, EDIT_FAILED)
    const images = (json?.data ?? []).map((d) => d.b64_json).filter((b): b is string => !!b)
    if (images.length === 0) throw upstreamFailure('openai_edit_empty', {}, EDIT_FAILED)
    const costUsd = imageCostUsd(json?.usage)
    logger.info('openai_edit_usage', { size: input.size, drafts: images.length, ...json?.usage, costUsd })
    return { images, costUsd }
  }

  async findWords(input: DetectInput): Promise<AiWord[]> {
    const response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.visionModel,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: detectPrompt(input.width, input.height) },
              { type: 'input_image', image_url: input.image, detail: 'high' },
            ],
          },
        ],
        text: { format: { type: 'json_schema', name: 'text_words', schema: WORDS_SCHEMA, strict: true } },
      }),
      signal: AbortSignal.timeout(DETECT_TIMEOUT_MS),
    }).catch((err: unknown) => {
      throw upstreamFailure('openai_detect_unreachable', { error: String(err) }, DETECT_FAILED)
    })
    const json = (await response.json().catch(() => null)) as ResponsesOutput | null
    if (!response.ok || !json) throw upstreamFailure('openai_detect_failed', { status: response.status, error: json?.error?.message }, DETECT_FAILED)

    for (const item of json.output ?? []) {
      for (const part of item.content ?? []) {
        if (part.type === 'refusal') throw upstreamFailure('openai_detect_refused', { refusal: part.refusal }, DETECT_FAILED)
        if (part.type === 'output_text' && part.text) return (JSON.parse(part.text) as { words: AiWord[] }).words
      }
    }
    throw upstreamFailure('openai_detect_empty', {}, DETECT_FAILED)
  }
}
