import { aiApi } from '../api/ai'
import type { AiPatch, Rect, TextRegion } from '../types'
import { textWidth } from './render'
import { clampRect, colorDistance, createCanvas, differentInk, get2d, hexToRgb, padRect, type RGB } from './image'

const CONTEXT_HEIGHT_RATIO = 1.2
const MIN_CONTEXT = 48
const SIZE_STEP = 16
const SAFE_ASPECT = 2.9
const MIN_PIXELS = 655_360
const TARGET_PIXELS = 1_572_864
const MAX_EDGE = 3840
const FEATHER = 5
const MIN_EDGE_MARGIN = FEATHER * 2 + 2
const EDGE_MARGIN_RATIO = 0.08
const GROW_SLACK = 1.08
const SPILL_RING_RATIO = 0.12
const MIN_SPILL_RING = 4
const SHIFT_TOLERANCE_RATIO = 0.03
const MIN_SHIFT_TOLERANCE = 3
const MAX_SPILL = 0.01
const CHANGE_SHARE = 0.4
const MIN_INK_KEPT = 0.3

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step)
}

function placeSpan(center: number, size: number, limit: number): number {
  return size <= limit ? Math.min(limit - size, Math.max(0, Math.round(center - size / 2))) : Math.round(center - size / 2)
}

function contextCrop(area: Rect, imageW: number, imageH: number): Rect {
  const pad = Math.max(MIN_CONTEXT, Math.round(area.h * CONTEXT_HEIGHT_RATIO))
  let w = Math.min(imageW, area.w + pad * 2)
  let h = Math.min(imageH, area.h + pad * 2)
  if (w / h > SAFE_ASPECT) h = Math.min(imageH, Math.ceil(w / SAFE_ASPECT))
  if (h / w > SAFE_ASPECT) w = Math.min(imageW, Math.ceil(h / SAFE_ASPECT))
  if (w / h > SAFE_ASPECT) w = Math.max(area.w, Math.ceil(h * SAFE_ASPECT))
  if (h / w > SAFE_ASPECT) h = Math.max(area.h, Math.ceil(w * SAFE_ASPECT))
  if (w / h > SAFE_ASPECT) h = Math.ceil(w / SAFE_ASPECT)
  if (h / w > SAFE_ASPECT) w = Math.ceil(h / SAFE_ASPECT)

  return {
    x: placeSpan(area.x + area.w / 2, w, imageW),
    y: placeSpan(area.y + area.h / 2, h, imageH),
    w,
    h,
  }
}

function modelSize(crop: Rect): { w: number; h: number } {
  const pixels = crop.w * crop.h
  const target = Math.min(TARGET_PIXELS, Math.max(MIN_PIXELS * 1.05, pixels))
  const scale = Math.min(Math.sqrt(target / pixels), MAX_EDGE / Math.max(crop.w, crop.h))
  return { w: roundTo(crop.w * scale, SIZE_STEP), h: roundTo(crop.h * scale, SIZE_STEP) }
}

function base64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1]
}

function loadPng(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the AI result'))
    img.src = `data:image/png;base64,${base64}`
  })
}

const COLOR_BAND = 4
const COLOR_SMOOTHING = 9
const MAX_COLOR_SHIFT = 40

type EdgeShift = (number[] | null)[]

function medianSmooth(values: (number[] | null)[], window: number): EdgeShift {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    const near = values.slice(Math.max(0, i - half), i + half + 1).filter((v): v is number[] => v !== null)
    if (near.length === 0) return null
    return [0, 1, 2].map((c) => {
      const sorted = near.map((v) => v[c]).sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    })
  })
}

function matchPatchColors(patch: HTMLCanvasElement, draft: HTMLCanvasElement, base: HTMLCanvasElement, crop: Rect, area: Rect): void {
  const original = get2d(base).getImageData(0, 0, base.width, base.height).data
  const drawn = get2d(draft).getImageData(0, 0, draft.width, draft.height).data
  const shiftAt = (gx: number, gy: number): number[] | null => {
    const lx = gx - crop.x
    const ly = gy - crop.y
    if (gx < 0 || gy < 0 || gx >= base.width || gy >= base.height || lx < 0 || ly < 0 || lx >= draft.width || ly >= draft.height) return null
    const o = (gy * base.width + gx) * 4
    const d = (ly * draft.width + lx) * 4
    const shift = [0, 1, 2].map((c) => original[o + c] - drawn[d + c])
    return shift.every((s) => Math.abs(s) <= MAX_COLOR_SHIFT) ? shift : null
  }
  const band = (pick: (k: number) => [number, number]): number[] | null => {
    const samples = Array.from({ length: COLOR_BAND }, (_, k) => shiftAt(...pick(k + 1))).filter((s): s is number[] => s !== null)
    return samples.length ? [0, 1, 2].map((c) => samples.reduce((sum, s) => sum + s[c], 0) / samples.length) : null
  }
  const top = medianSmooth(Array.from({ length: area.w }, (_, i) => band((k) => [area.x + i, area.y - k])), COLOR_SMOOTHING)
  const bottom = medianSmooth(Array.from({ length: area.w }, (_, i) => band((k) => [area.x + i, area.y + area.h - 1 + k])), COLOR_SMOOTHING)
  const left = medianSmooth(Array.from({ length: area.h }, (_, j) => band((k) => [area.x - k, area.y + j])), COLOR_SMOOTHING)
  const right = medianSmooth(Array.from({ length: area.h }, (_, j) => band((k) => [area.x + area.w - 1 + k, area.y + j])), COLOR_SMOOTHING)

  const blend = (a: number[] | null, b: number[] | null, t: number): number[] | null => {
    if (a && b) return a.map((v, c) => v * (1 - t) + b[c] * t)
    return a ?? b
  }
  const vWeight = area.w / (area.w + area.h)
  const ctx = get2d(patch)
  const pixels = ctx.getImageData(0, 0, patch.width, patch.height)
  for (let y = 0; y < patch.height; y++) {
    const ty = (y + 0.5) / patch.height
    for (let x = 0; x < patch.width; x++) {
      const tx = (x + 0.5) / patch.width
      const vertical = blend(top[x], bottom[x], ty)
      const horizontal = blend(left[y], right[y], tx)
      const shift = vertical && horizontal ? vertical.map((v, c) => v * vWeight + horizontal[c] * (1 - vWeight)) : (vertical ?? horizontal)
      if (!shift) continue
      const i = (y * patch.width + x) * 4
      for (let c = 0; c < 3; c++) pixels.data[i + c] = pixels.data[i + c] + shift[c]
    }
  }
  ctx.putImageData(pixels, 0, 0)
}

function featherEdges(canvas: HTMLCanvasElement): void {
  const ctx = get2d(canvas)
  const { width, height } = canvas
  const pixels = ctx.getImageData(0, 0, width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y) + 1
      if (edge > FEATHER) continue
      pixels.data[(y * width + x) * 4 + 3] = Math.round((255 * edge) / (FEATHER + 1))
    }
  }
  ctx.putImageData(pixels, 0, 0)
}

function measureSpill(draft: HTMLCanvasElement, base: HTMLCanvasElement, crop: Rect, area: Rect, ink: RGB, bg: RGB): number {
  const ring = Math.max(MIN_SPILL_RING, Math.round(area.h * SPILL_RING_RATIO))
  const outer = clampRect(padRect(area, ring), base.width, base.height)
  const drawn = get2d(draft).getImageData(outer.x - crop.x, outer.y - crop.y, outer.w, outer.h).data
  const original = get2d(base).getImageData(outer.x, outer.y, outer.w, outer.h).data
  const isInk = (data: Uint8ClampedArray, i: number) => {
    const px: RGB = [data[i], data[i + 1], data[i + 2]]
    return colorDistance(px, ink) < colorDistance(px, bg)
  }

  const tolerance = Math.max(MIN_SHIFT_TOLERANCE, Math.round(area.h * SHIFT_TOLERANCE_RATIO))
  const nearOriginalInk = (x: number, y: number) => {
    for (let dy = -tolerance; dy <= tolerance; dy++) {
      for (let dx = -tolerance; dx <= tolerance; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= outer.w || ny >= outer.h) continue
        if (isInk(original, (ny * outer.w + nx) * 4)) return true
      }
    }
    return false
  }

  const changeLimit = CHANGE_SHARE * colorDistance(ink, bg)
  let ringPixels = 0
  let spilled = 0
  for (let y = 0; y < outer.h; y++) {
    for (let x = 0; x < outer.w; x++) {
      const gx = outer.x + x
      const gy = outer.y + y
      const insideCore =
        gx >= area.x + FEATHER && gx < area.x + area.w - FEATHER && gy >= area.y + FEATHER && gy < area.y + area.h - FEATHER
      if (insideCore) continue
      const i = (y * outer.w + x) * 4
      ringPixels++
      const changed = colorDistance([drawn[i], drawn[i + 1], drawn[i + 2]], [original[i], original[i + 1], original[i + 2]]) > changeLimit
      if (changed && !nearOriginalInk(x, y)) spilled++
    }
  }
  return ringPixels === 0 ? 0 : spilled / ringPixels
}

function inkShare(canvas: HTMLCanvasElement, r: Rect, ink: RGB, bg: RGB): number {
  const data = get2d(canvas).getImageData(r.x, r.y, r.w, r.h).data
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const px: RGB = [data[i], data[i + 1], data[i + 2]]
    if (colorDistance(px, ink) < colorDistance(px, bg)) count++
  }
  return count / (r.w * r.h)
}

const letterCount = (text: string) => text.replace(/\s/g, '').length

const STROKE_CORE_SHARE = 0.6
const STROKE_PERCENTILE = 0.98

function strokeColor(canvas: HTMLCanvasElement, r: Rect, bg: RGB): string | null {
  const data = get2d(canvas).getImageData(r.x, r.y, r.w, r.h).data
  const distances: number[] = []
  for (let i = 0; i < data.length; i += 4) distances.push(colorDistance([data[i], data[i + 1], data[i + 2]], bg))
  const strongest = [...distances].sort((a, b) => a - b)[Math.floor(distances.length * STROKE_PERCENTILE)]
  if (!strongest) return null
  const sum = [0, 0, 0]
  let count = 0
  distances.forEach((d, p) => {
    if (d < strongest * STROKE_CORE_SHARE) return
    for (let c = 0; c < 3; c++) sum[c] += data[p * 4 + c]
    count++
  })
  if (count === 0) return null
  return '#' + sum.map((v) => Math.round(v / count).toString(16).padStart(2, '0')).join('')
}

type DraftProblem = 'outside' | 'missing' | 'colour'

const PROBLEM_MESSAGES: Record<DraftProblem, string> = {
  outside: 'The AI drew the text outside the box, so it would look cut off.',
  missing: 'The AI did not draw the new text inside the box.',
  colour: 'The AI used a different text colour than the original.',
}

function inkChanged(drawnInk: string | null, originalInk: string | null): boolean {
  return !!drawnInk && !!originalInk && differentInk(drawnInk, originalInk)
}

function checkDraft(draft: HTMLCanvasElement, base: HTMLCanvasElement, crop: Rect, area: Rect, region: TextRegion) {
  const ink = hexToRgb(region.style.color)
  const bg = hexToRgb(region.style.bgColor)
  const local = { x: area.x - crop.x, y: area.y - crop.y, w: area.w, h: area.h }
  const spill = measureSpill(draft, base, crop, area, ink, bg)

  const oldLetters = letterCount(region.originalText)
  const expected = oldLetters ? (inkShare(base, area, ink, bg) * letterCount(region.text)) / oldLetters : 0
  const drawn = inkShare(draft, local, ink, bg)

  let problem: DraftProblem | null = null
  if (spill > MAX_SPILL) problem = 'outside'
  else if (expected > 0 && drawn < expected * MIN_INK_KEPT) problem = 'missing'
  else if (inkChanged(strokeColor(draft, local, bg), strokeColor(base, area, bg))) problem = 'colour'
  return { canvas: draft, spill, problem }
}

function roomForText(region: TextRegion): Rect {
  const { rect, style } = region
  const oldWidth = region.originalText ? textWidth(region.originalText, style) : 0
  if (oldWidth <= 0) return rect
  const ratio = textWidth(region.text, style) / oldWidth
  const extra = Math.ceil(rect.w * (ratio * GROW_SLACK - 1) * Math.cos((style.rotation * Math.PI) / 180))
  if (extra <= 0) return rect
  if (style.align === 'right') return { ...rect, x: rect.x - extra, w: rect.w + extra }
  if (style.align === 'center') return { ...rect, x: rect.x - extra / 2, w: rect.w + extra }
  return { ...rect, w: rect.w + extra }
}

export class AiDraftRejectedError extends Error {
  readonly credits: number | null

  constructor(message: string, credits: number | null) {
    super(message)
    this.credits = credits
  }
}

export interface AiEditOutcome {
  patch: AiPatch
  credits: number
}

export async function aiReplaceText(base: HTMLCanvasElement, region: TextRegion): Promise<AiEditOutcome> {
  const margin = Math.max(MIN_EDGE_MARGIN, region.style.padding, Math.round(region.rect.h * EDGE_MARGIN_RATIO))
  const area = clampRect(padRect(roomForText(region), margin), base.width, base.height)
  if (area.w === 0 || area.h === 0) throw new Error('The box is outside the image')

  const crop = contextCrop(area, base.width, base.height)
  const size = modelSize(crop)
  const sx = size.w / crop.w
  const sy = size.h / crop.h

  const image = createCanvas(size.w, size.h)
  const imageCtx = get2d(image)
  imageCtx.fillStyle = region.style.bgColor
  imageCtx.fillRect(0, 0, size.w, size.h)
  imageCtx.drawImage(base, crop.x, crop.y, crop.w, crop.h, 0, 0, size.w, size.h)

  const mask = createCanvas(size.w, size.h)
  const maskCtx = get2d(mask)
  maskCtx.fillStyle = '#000'
  maskCtx.fillRect(0, 0, size.w, size.h)
  maskCtx.clearRect(
    Math.floor((area.x - crop.x) * sx),
    Math.floor((area.y - crop.y) * sy),
    Math.ceil(area.w * sx),
    Math.ceil(area.h * sy),
  )

  const result = await aiApi.edit({
    image: base64Png(image),
    mask: base64Png(mask),
    size: `${size.w}x${size.h}`,
    oldText: region.originalText,
    newText: region.text,
    color: region.style.color,
    fontHint: `${region.style.fontFamily}${region.style.fontWeight === 'bold' ? ', bold' : ''}`,
  })
  const drafts = await Promise.all(result.images.map(loadPng))

  const scored = drafts.map((draft) => {
    const canvas = createCanvas(crop.w, crop.h)
    get2d(canvas).drawImage(draft, 0, 0, crop.w, crop.h)
    return checkDraft(canvas, base, crop, area, region)
  })
  const passing = scored.filter((s) => !s.problem)
  if (passing.length === 0) {
    const credits = await aiApi.refund(result.jobId).catch(() => null)
    const refundNote = credits !== null ? ' Your credit was returned.' : ''
    throw new AiDraftRejectedError(`${PROBLEM_MESSAGES[scored[0].problem!]}${refundNote} Click “Try again”.`, credits)
  }
  const best = passing.reduce((a, b) => (b.spill < a.spill ? b : a))

  const patch = createCanvas(area.w, area.h)
  get2d(patch).drawImage(best.canvas, area.x - crop.x, area.y - crop.y, area.w, area.h, 0, 0, area.w, area.h)
  matchPatchColors(patch, best.canvas, base, crop, area)
  featherEdges(patch)

  return { patch: { canvas: patch, rect: area, text: region.text }, credits: result.credits }
}
