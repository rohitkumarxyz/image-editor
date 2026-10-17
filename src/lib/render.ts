import type { Rect, TextRegion, TextStyle } from '../types'
import { downloadBlob } from './download'
import { createCanvas, get2d, padRect, smartFill } from './image'

const REFERENCE_SIZE = 100
const FALLBACK_REFERENCE_TEXT = 'Hg'

let scratch: CanvasRenderingContext2D | null = null
function scratchCtx(): CanvasRenderingContext2D {
  scratch ??= get2d(createCanvas(4, 4))
  return scratch
}

export function fontString(style: Pick<TextStyle, 'fontWeight' | 'fontSize' | 'fontFamily'>): string {
  return `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`
}

function inkHeight(ctx: CanvasRenderingContext2D, text: string): { ascent: number; descent: number } {
  const m = ctx.measureText(text || FALLBACK_REFERENCE_TEXT)
  return { ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent }
}

export function textWidth(text: string, style: Pick<TextStyle, 'fontWeight' | 'fontSize' | 'fontFamily' | 'letterSpacing'>): number {
  const ctx = scratchCtx()
  ctx.font = fontString(style)
  ctx.letterSpacing = '0px'
  const m = ctx.measureText(text)
  return m.actualBoundingBoxLeft + m.actualBoundingBoxRight + style.letterSpacing * Math.max(0, Array.from(text).length - 1)
}

export function estimateFontSize(text: string, fontFamily: string, fontWeight: TextStyle['fontWeight'], boxHeight: number): number {
  const ctx = scratchCtx()
  ctx.font = fontString({ fontFamily, fontWeight, fontSize: REFERENCE_SIZE })
  const { ascent, descent } = inkHeight(ctx, text)
  const ink = ascent + descent
  if (ink <= 0) return Math.max(8, Math.round(boxHeight))
  return Math.max(6, Math.round((boxHeight * REFERENCE_SIZE) / ink))
}

function eraseRegion(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, region: TextRegion): void {
  const area = padRect(region.rect, region.style.padding)
  if (region.style.eraseMode === 'smart') {
    smartFill(ctx, base, area, { ink: region.style.color, bg: region.style.bgColor })
    return
  }
  ctx.fillStyle = region.style.bgColor
  ctx.fillRect(area.x, area.y, area.w, area.h)
}

const MIN_UPRIGHT_RATIO = 0.25

export function uprightRect(rect: Rect, rotation: number): Rect {
  if (!rotation) return rect
  const t = Math.abs((rotation * Math.PI) / 180)
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  const d = cos * cos - sin * sin
  const w = Math.max(rect.w * MIN_UPRIGHT_RATIO, (rect.w * cos - rect.h * sin) / d)
  const h = Math.max(rect.h * MIN_UPRIGHT_RATIO, (rect.h * cos - rect.w * sin) / d)
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }
}

function drawRegionText(ctx: CanvasRenderingContext2D, region: TextRegion): void {
  const { style, text } = region
  if (!text) return
  const rect = uprightRect(region.rect, style.rotation)

  ctx.save()
  if (style.rotation) {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    ctx.translate(cx, cy)
    ctx.rotate((style.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  ctx.font = fontString(style)
  ctx.fillStyle = style.color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const ref = inkHeight(ctx, region.originalText || text)
  const baselineY = rect.y + (rect.h - (ref.ascent + ref.descent)) / 2 + ref.ascent + style.offsetY

  const m = ctx.measureText(text)
  const inkLeft = m.actualBoundingBoxLeft
  const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight + style.letterSpacing * (Array.from(text).length - 1)
  ctx.letterSpacing = `${style.letterSpacing}px`

  if (style.fitWidth && inkWidth > 0) {
    ctx.translate(rect.x + style.offsetX, baselineY)
    ctx.scale(rect.w / inkWidth, 1)
    ctx.fillText(text, inkLeft, 0)
  } else {
    let x = rect.x + inkLeft
    if (style.align === 'center') x = rect.x + (rect.w - inkWidth) / 2 + inkLeft
    if (style.align === 'right') x = rect.x + rect.w - inkWidth + inkLeft
    ctx.fillText(text, x + style.offsetX, baselineY)
  }
  ctx.restore()
}

export function renderComposite(target: HTMLCanvasElement, base: HTMLCanvasElement, regions: TextRegion[]): void {
  if (target.width !== base.width) target.width = base.width
  if (target.height !== base.height) target.height = base.height
  const ctx = get2d(target)
  ctx.drawImage(base, 0, 0)

  const edited = regions.filter((r) => r.edited)
  const typed = edited.filter((r) => !r.aiPatch)
  typed.forEach((r) => eraseRegion(ctx, base, r))
  edited.forEach((r) => r.aiPatch && ctx.drawImage(r.aiPatch.canvas, r.aiPatch.rect.x, r.aiPatch.rect.y))
  typed.forEach((r) => drawRegionText(ctx, r))
}

export function exportPng(base: HTMLCanvasElement, regions: TextRegion[], fileName: string): void {
  const out = createCanvas(base.width, base.height)
  renderComposite(out, base, regions)
  out.toBlob((blob) => blob && downloadBlob(blob, fileName), 'image/png')
}
