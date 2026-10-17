import type { FontWeight, Rect, TextStyle } from '../types'
import { hasDevanagari, matchCandidates } from './fonts'
import { clampRect, createCanvas, findInkBox, get2d, hexToRgb, pixelDistance as distance, type RGB } from './image'
import { estimateFontSize, fontString } from './render'

export type FontMatch = Pick<TextStyle, 'fontFamily' | 'fontWeight' | 'fontSize' | 'letterSpacing' | 'rotation'>

export interface CandidateScore {
  family: string
  weight: FontWeight
  spacing: number
  score: number
}

export interface FontScores {
  rotation: number
  height: number
  candidates: CandidateScore[]
}

const REFERENCE_SIZE = 100
const NORM_HEIGHT = 32
const MAX_NORM_WIDTH = 1024
const MIN_INK_HEIGHT = 4
const MIN_SPACING = -0.15 * REFERENCE_SIZE
const MAX_SPACING = 0.8 * REFERENCE_SIZE
const ALPHA_INK = 127
const PROBE_TEXT = 'mmmmmmmmmmlli1WQअक'
const MAX_ROTATION = 20
const MIN_ROTATION = 3
const MAX_ROTATION_POINTS = 20_000
const MIN_ROTATION_POINTS = 50
const ROTATION_GAIN = 1.04

const availability = new Map<string, boolean>()
let scratch: CanvasRenderingContext2D | null = null
function scratchCtx(): CanvasRenderingContext2D {
  scratch ??= get2d(createCanvas(4, 4))
  return scratch
}

function isFontAvailable(family: string): boolean {
  const cached = availability.get(family)
  if (cached !== undefined) return cached
  const ctx = scratchCtx()
  const available = ['monospace', 'serif', 'sans-serif'].some((generic) => {
    ctx.font = `72px ${generic}`
    const fallback = ctx.measureText(PROBE_TEXT).width
    ctx.font = `72px "${family}", ${generic}`
    return ctx.measureText(PROBE_TEXT).width !== fallback
  })
  availability.set(family, available)
  return available
}

function imageMask(base: HTMLCanvasElement, box: Rect, width: number, ink: RGB, bg: RGB): Uint8Array {
  const ctx = get2d(createCanvas(width, NORM_HEIGHT))
  ctx.drawImage(base, box.x, box.y, box.w, box.h, 0, 0, width, NORM_HEIGHT)
  const data = ctx.getImageData(0, 0, width, NORM_HEIGHT).data
  const mask = new Uint8Array(width * NORM_HEIGHT)
  for (let p = 0; p < mask.length; p++) mask[p] = distance(data, p * 4, ink) < distance(data, p * 4, bg) ? 1 : 0
  return mask
}

function renderCandidate(
  text: string,
  family: string,
  weight: FontWeight,
  box: Rect,
  width: number,
): { spacing: number; mask: Uint8Array } | null {
  const measure = scratchCtx()
  measure.font = fontString({ fontFamily: family, fontWeight: weight, fontSize: REFERENCE_SIZE })
  measure.letterSpacing = '0px'
  const m = measure.measureText(text)
  const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
  const inkHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  if (inkWidth <= 0 || inkHeight <= 0) return null

  const gaps = Array.from(text).length - 1
  const targetWidth = (box.w * inkHeight) / box.h
  const spacing =
    gaps > 0 && !hasDevanagari(text) ? Math.min(MAX_SPACING, Math.max(MIN_SPACING, (targetWidth - inkWidth) / gaps)) : 0

  const ctx = get2d(createCanvas(width, NORM_HEIGHT))
  const s = NORM_HEIGHT / inkHeight
  ctx.setTransform(s, 0, 0, s, s * m.actualBoundingBoxLeft, s * m.actualBoundingBoxAscent)
  ctx.font = measure.font
  ctx.letterSpacing = `${spacing}px`
  ctx.fillStyle = '#000'
  ctx.fillText(text, 0, 0)

  const data = ctx.getImageData(0, 0, width, NORM_HEIGHT).data
  const mask = new Uint8Array(width * NORM_HEIGHT)
  for (let p = 0; p < mask.length; p++) mask[p] = data[p * 4 + 3] > ALPHA_INK ? 1 : 0
  return { spacing, mask }
}

function overlapScore(a: Uint8Array, b: Uint8Array): number {
  let both = 0
  let either = 0
  let inA = 0
  let inB = 0
  for (let i = 0; i < a.length; i++) {
    both += a[i] & b[i]
    either += a[i] | b[i]
    inA += a[i]
    inB += b[i]
  }
  if (either === 0) return 0
  return (both / either) * (Math.min(inA, inB) / Math.max(inA, inB))
}

function inkPoints(base: HTMLCanvasElement, r: Rect, ink: RGB, bg: RGB): [number, number][] {
  const data = get2d(base).getImageData(r.x, r.y, r.w, r.h).data
  const points: [number, number][] = []
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4
      if (distance(data, i, ink) < distance(data, i, bg)) points.push([x, y])
    }
  }
  const step = Math.ceil(points.length / MAX_ROTATION_POINTS)
  return step > 1 ? points.filter((_, k) => k % step === 0) : points
}

function rowSharpness(points: [number, number][], degrees: number): number {
  const a = (degrees * Math.PI) / 180
  const sin = Math.sin(a)
  const cos = Math.cos(a)
  const rows = new Map<number, number>()
  for (const [x, y] of points) {
    const row = Math.round(-x * sin + y * cos)
    rows.set(row, (rows.get(row) ?? 0) + 1)
  }
  let sum = 0
  for (const count of rows.values()) sum += count * count
  return sum
}

function estimateRotation(base: HTMLCanvasElement, r: Rect, ink: RGB, bg: RGB): number {
  const points = inkPoints(base, r, ink, bg)
  if (points.length < MIN_ROTATION_POINTS) return 0
  const upright = rowSharpness(points, 0)
  let best = 0
  let bestScore = upright
  for (let deg = -MAX_ROTATION; deg <= MAX_ROTATION; deg++) {
    const score = rowSharpness(points, deg)
    if (score > bestScore) {
      best = deg
      bestScore = score
    }
  }
  return Math.abs(best) >= MIN_ROTATION && bestScore > upright * ROTATION_GAIN ? best : 0
}

function straighten(base: HTMLCanvasElement, r: Rect, rotation: number, bgHex: string): HTMLCanvasElement {
  const a = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const out = createCanvas(Math.ceil(r.w * cos + r.h * sin), Math.ceil(r.w * sin + r.h * cos))
  const ctx = get2d(out)
  ctx.fillStyle = bgHex
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate(-a)
  ctx.drawImage(base, r.x, r.y, r.w, r.h, -r.w / 2, -r.h / 2, r.w, r.h)
  return out
}

export function scoreFonts(base: HTMLCanvasElement, rect: Rect, text: string, inkHex: string, bgHex: string): FontScores | null {
  if (!text.trim()) return null
  const ink = hexToRgb(inkHex)
  const bg = hexToRgb(bgHex)
  const r = clampRect(rect, base.width, base.height)
  if (r.w === 0 || r.h === 0) return null

  const rotation = estimateRotation(base, r, ink, bg)
  const source = rotation ? straighten(base, r, rotation, bgHex) : base
  const box = findInkBox(source, rotation ? { x: 0, y: 0, w: source.width, h: source.height } : r, ink, bg)
  if (!box || box.h < MIN_INK_HEIGHT) return null

  const width = Math.max(1, Math.min(MAX_NORM_WIDTH, Math.round((box.w * NORM_HEIGHT) / box.h)))
  const real = imageMask(source, box, width, ink, bg)

  const candidates: CandidateScore[] = []
  for (const { family, weight } of matchCandidates(text)) {
    if (!isFontAvailable(family)) continue
    const candidate = renderCandidate(text, family, weight, box, width)
    if (!candidate) continue
    candidates.push({ family, weight, spacing: candidate.spacing, score: overlapScore(real, candidate.mask) })
  }
  return candidates.length ? { rotation, height: rotation ? box.h : rect.h, candidates } : null
}

export function toFontMatch(choice: CandidateScore, text: string, height: number, rotation: number, fontSize?: number): FontMatch {
  const size = fontSize ?? estimateFontSize(text, choice.family, choice.weight, height)
  return {
    fontFamily: choice.family,
    fontWeight: choice.weight,
    fontSize: size,
    letterSpacing: Math.round(((choice.spacing * size) / REFERENCE_SIZE) * 10) / 10,
    rotation,
  }
}

export function matchFont(base: HTMLCanvasElement, rect: Rect, text: string, inkHex: string, bgHex: string): FontMatch | null {
  const scores = scoreFonts(base, rect, text, inkHex, bgHex)
  if (!scores) return null
  const best = scores.candidates.reduce((a, b) => (b.score > a.score ? b : a))
  return toFontMatch(best, text, scores.height, scores.rotation)
}
