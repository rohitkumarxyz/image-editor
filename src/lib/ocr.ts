import { createWorker, PSM, type Bbox, type Worker } from 'tesseract.js'
import type { OcrLanguage, OcrLevel, Rect } from '../types'
import { differentInk, sampleColors } from './image'
import { prepareForOcr } from './preprocess'

interface OcrWord {
  text: string
  rect: Rect
  confidence: number
}

export interface OcrBox extends OcrWord {
  /** Words of a line box, used to split lines that mix ink colours. */
  words?: OcrWord[]
}

export type ProgressHandler = (message: string, progress: number) => void

const MIN_CONFIDENCE = 40
const STRONG_CONFIDENCE = 70
const OVERLAP_LIMIT = 0.3
const MIN_BOX_SIZE = 6

let cached: { lang: OcrLanguage; worker: Promise<Worker> } | null = null
let onProgress: ProgressHandler | null = null

function getWorker(lang: OcrLanguage): Promise<Worker> {
  if (cached?.lang === lang) return cached.worker

  cached?.worker.then((w) => w.terminate()).catch(() => undefined)
  const worker = createWorker(lang.split('+'), 1, {
    logger: (m) => onProgress?.(m.status, m.progress),
  })
  cached = { lang, worker }
  worker.catch(() => {
    if (cached?.worker === worker) cached = null
  })
  return worker
}

function toRect(b: Bbox): Rect {
  return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }
}

function overlapRatio(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.min(a.w * a.h, b.w * b.h)
}

function isLikelyText(box: OcrBox): boolean {
  const meaningful = box.text.replace(/[^\p{L}\p{N}]/gu, '').length
  if (meaningful === 0) return false
  if (box.confidence >= STRONG_CONFIDENCE) return true
  return box.confidence >= MIN_CONFIDENCE && meaningful >= 3
}

/** Keeps the more confident box wherever two passes found the same text. */
function mergePasses(passes: OcrBox[][]): OcrBox[] {
  const all = passes.flat().filter(isLikelyText).sort((a, b) => b.confidence - a.confidence)
  const kept: OcrBox[] = []
  for (const box of all) {
    if (!kept.some((k) => overlapRatio(k.rect, box.rect) > OVERLAP_LIMIT)) kept.push(box)
  }
  return kept.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
}

async function recognizePass(worker: Worker, image: HTMLCanvasElement, level: OcrLevel): Promise<OcrBox[]> {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' })
  const { data } = await worker.recognize(image, {}, { blocks: true })

  const boxes: OcrBox[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const items = level === 'line' ? [line] : line.words
        for (const item of items) {
          const text = item.text.trim()
          const rect = toRect(item.bbox)
          if (!text || rect.w < MIN_BOX_SIZE || rect.h < MIN_BOX_SIZE) continue
          const words =
            level === 'line'
              ? line.words
                  .map((w) => ({ text: w.text.trim(), rect: toRect(w.bbox), confidence: w.confidence }))
                  .filter((w) => w.text && w.rect.w > 0 && w.rect.h > 0)
              : undefined
          boxes.push({ text, rect, confidence: item.confidence, words })
        }
      }
    }
  }
  return boxes
}

function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const x2 = Math.max(...rects.map((r) => r.x + r.w))
  const y2 = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: x2 - x, h: y2 - y }
}

/**
 * Splits a line wherever the ink colour changes between words, e.g. a green printed label followed by a
 * black typed value. Otherwise the whole line gets one colour and font, and editing the value redraws it
 * in the label's style. Colours are read from the original image (the cleaned OCR copy has none).
 */
function splitByInkColor(image: HTMLCanvasElement, box: OcrBox): OcrBox[] {
  const words = box.words ?? []
  if (words.length < 2) return [box]

  const groups: { ink: string; words: OcrWord[] }[] = []
  for (const word of words) {
    const ink = sampleColors(image, word.rect).ink
    const current = groups[groups.length - 1]
    if (current && !differentInk(current.ink, ink)) current.words.push(word)
    else groups.push({ ink, words: [word] })
  }
  if (groups.length < 2) return [box]

  return groups.map((g) => ({
    text: g.words.map((w) => w.text).join(' '),
    rect: unionRect(g.words.map((w) => w.rect)),
    confidence: Math.min(...g.words.map((w) => w.confidence)),
  }))
}

/** Below this OCR confidence, a box the AI saw no text at is treated as noise (e.g. plants read as letters). */
const NOISE_CONFIDENCE = 80

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** True when an OCR box only caught part of the word the AI read (e.g. "Th" of "Things"). */
function isFragmentOf(ocrText: string, aiText: string): boolean {
  const ocr = letters(ocrText)
  const ai = letters(aiText)
  return ocr.length < ai.length && (ai.includes(ocr) || ocr.length * 2 <= ai.length)
}

/**
 * Combines Tesseract boxes with the AI finder's words. Tesseract boxes stay where they are good (exact
 * line boxes for printed text); an AI word replaces Tesseract fragments of it, low-confidence Tesseract boxes
 * where the AI saw nothing are dropped, and AI words nothing covers are added.
 */
export function mergeWithAi<T extends { text: string; rect: Rect }>(found: OcrBox[], aiWords: T[]): { kept: OcrBox[]; added: T[] } {
  const replaced = new Set<OcrBox>()
  const added: T[] = []
  for (const word of aiWords) {
    const overlapping = found.filter((f) => overlapRatio(f.rect, word.rect) > OVERLAP_LIMIT)
    if (overlapping.length === 0) {
      added.push(word)
      continue
    }
    if (overlapping.every((f) => isFragmentOf(f.text, word.text))) {
      overlapping.forEach((f) => replaced.add(f))
      added.push(word)
    }
  }
  const kept = found.filter(
    (f) => !replaced.has(f) && (f.confidence >= NOISE_CONFIDENCE || aiWords.some((w) => overlapRatio(f.rect, w.rect) > 0)),
  )
  return { kept, added }
}

/**
 * Runs two passes and merges them: a cleaned black-and-white copy (best for coloured print and
 * uneven lighting) and the original (best for faint dot-matrix / typed text).
 */
export async function detectText(
  image: HTMLCanvasElement,
  lang: OcrLanguage,
  level: OcrLevel,
  progress: ProgressHandler,
): Promise<OcrBox[]> {
  try {
    onProgress = progress
    const worker = await getWorker(lang)

    onProgress = (_, p) => progress('Finding text…', p / 2)
    const cleaned = await recognizePass(worker, prepareForOcr(image), level)

    onProgress = (_, p) => progress('Finding text…', 0.5 + p / 2)
    const original = await recognizePass(worker, image, level)

    return mergePasses([cleaned, original]).flatMap((box) => splitByInkColor(image, box))
  } finally {
    onProgress = null
  }
}
