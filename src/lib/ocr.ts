import { createWorker, PSM, type Bbox, type Worker } from 'tesseract.js'
import type { OcrLanguage, OcrLevel, Rect } from '../types'
import { clampRect, createCanvas, differentInk, get2d, padRect, sampleColors } from './image'
import { invertForOcr, prepareForOcr } from './preprocess'

interface OcrWord {
  text: string
  rect: Rect
  confidence: number
}

export interface OcrBox extends OcrWord {
  words?: OcrWord[]
}

export type ProgressHandler = (message: string, progress: number) => void

const MIN_CONFIDENCE = 40
const STRONG_CONFIDENCE = 70
const OVERLAP_LIMIT = 0.3
const MIN_BOX_SIZE = 6
const AREA_TARGET_HEIGHT = 96
const AREA_MAX_SCALE = 4
const AREA_PAD = 8

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

const NOISE_CONFIDENCE = 80

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function isFragmentOf(ocrText: string, aiText: string): boolean {
  const ocr = letters(ocrText)
  const ai = letters(aiText)
  return ocr.length < ai.length && (ai.includes(ocr) || ocr.length * 2 <= ai.length)
}

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

export async function readArea(image: HTMLCanvasElement, rect: Rect, lang: OcrLanguage): Promise<OcrWord | null> {
  const area = clampRect(padRect(rect, AREA_PAD), image.width, image.height)
  if (area.w < MIN_BOX_SIZE || area.h < MIN_BOX_SIZE) return null
  const scale = Math.min(AREA_MAX_SCALE, Math.max(1, AREA_TARGET_HEIGHT / rect.h))
  const crop = createCanvas(Math.round(area.w * scale), Math.round(area.h * scale))
  const ctx = get2d(crop)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, area.x, area.y, area.w, area.h, 0, 0, crop.width, crop.height)

  const worker = await getWorker(lang)
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
  let best: OcrWord | null = null
  for (const variant of [crop, prepareForOcr(crop), prepareForOcr(invertForOcr(crop))]) {
    const { data } = await worker.recognize(variant, {}, { blocks: true })
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    const words = lines.flatMap((l) => l.words).filter((w) => w.text.trim())
    const text = lines.map((l) => l.text.trim()).filter(Boolean).join(' ')
    if (!words.length || !text.replace(/[^\p{L}\p{N}]/gu, '')) continue
    if (best && data.confidence <= best.confidence) continue
    const inside = unionRect(words.map((w) => toRect(w.bbox)))
    best = {
      text,
      confidence: data.confidence,
      rect: clampRect({ x: area.x + inside.x / scale, y: area.y + inside.y / scale, w: inside.w / scale, h: inside.h / scale }, image.width, image.height),
    }
  }
  return best
}
