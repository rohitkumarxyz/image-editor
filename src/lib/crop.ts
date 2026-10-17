import type { CropAspect, CropShape, CropState, Point, Rect } from '../types'
import { clampRect, createCanvas, get2d } from './image'

const BOX_SHAPES: CropShape[] = ['rect', 'square', 'rounded', 'circle', 'ellipse']
const SQUARE_SHAPES: CropShape[] = ['square', 'circle']
const ASPECTS: Record<Exclude<CropAspect, 'free' | 'original'>, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
}
const MIN_CROP = 4
export const DEFAULT_RADIUS = 12

export function isBoxShape(shape: CropShape): boolean {
  return BOX_SHAPES.includes(shape)
}

export function hasAspectChoice(shape: CropShape): boolean {
  return isBoxShape(shape) && !SQUARE_SHAPES.includes(shape)
}

/** Width ÷ height the box must keep, or null when it is free. */
export function aspectRatio(crop: Pick<CropState, 'shape' | 'aspect'>, imageW: number, imageH: number): number | null {
  if (SQUARE_SHAPES.includes(crop.shape)) return 1
  if (!isBoxShape(crop.shape) || crop.aspect === 'free') return null
  if (crop.aspect === 'original') return imageW / imageH
  return ASPECTS[crop.aspect]
}

/** Largest box with the given aspect that fits inside `rect`, centred on it. */
export function fitToAspect(rect: Rect, aspect: number | null): Rect {
  if (!aspect) return rect
  const w = Math.min(rect.w, rect.h * aspect)
  const h = w / aspect
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }
}

/** Starts with nothing selected, so the first drag draws the crop area instead of moving a full-image box. */
export function initialCrop(): CropState {
  return { shape: 'rect', aspect: 'free', radius: DEFAULT_RADIUS, rect: null, points: [], closed: false }
}

/** Applies a settings change and keeps the selection valid for the new shape / aspect. */
export function updateCrop(crop: CropState, patch: Partial<CropState>, imageW: number, imageH: number): CropState {
  const next = { ...crop, ...patch }
  const shapeChanged = patch.shape !== undefined && patch.shape !== crop.shape
  if (isBoxShape(next.shape)) {
    if (shapeChanged || patch.aspect !== undefined) {
      const base = next.rect ?? { x: 0, y: 0, w: imageW, h: imageH }
      next.rect = fitToAspect(base, aspectRatio(next, imageW, imageH))
    }
  } else if (shapeChanged && patch.points === undefined) {
    next.points = []
    next.closed = false
  }
  return next
}

function boundsOf(points: Point[]): Rect {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Bounding box of the selection, or null if nothing croppable is selected yet. */
export function cropBounds(crop: CropState): Rect | null {
  const r = isBoxShape(crop.shape) ? crop.rect : crop.closed && crop.points.length >= 3 ? boundsOf(crop.points) : null
  return r && r.w >= MIN_CROP && r.h >= MIN_CROP ? r : null
}

function roundedPath({ x, y, w, h }: Rect, radiusPercent: number): string {
  const r = (Math.min(w, h) * Math.min(50, Math.max(0, radiusPercent))) / 100
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ')
}

function ellipsePath({ x, y, w, h }: Rect): string {
  const rx = w / 2
  const ry = h / 2
  const cy = y + ry
  return `M${x} ${cy} A${rx} ${ry} 0 1 0 ${x + w} ${cy} A${rx} ${ry} 0 1 0 ${x} ${cy} Z`
}

/**
 * SVG path of the selection. The same string draws the outline on screen and, through Path2D,
 * clips the image when cropping, so what you see is exactly what you get.
 */
export function shapePath(crop: CropState): string {
  if (isBoxShape(crop.shape)) {
    const r = crop.rect
    if (!r) return ''
    if (crop.shape === 'rounded') return roundedPath(r, crop.radius)
    if (crop.shape === 'circle' || crop.shape === 'ellipse') return ellipsePath(r)
    return `M${r.x} ${r.y} H${r.x + r.w} V${r.y + r.h} H${r.x} Z`
  }
  if (crop.points.length === 0) return ''
  const [first, ...rest] = crop.points
  return `M${first.x} ${first.y} ${rest.map((p) => `L${p.x} ${p.y}`).join(' ')}${crop.closed ? ' Z' : ''}`
}

/** Cuts the selection out of `source`. Outside a non-rectangular shape the result is transparent. */
export function applyCrop(source: HTMLCanvasElement, crop: CropState): HTMLCanvasElement | null {
  const bounds = cropBounds(crop)
  if (!bounds) return null
  const area = clampRect(bounds, source.width, source.height)
  if (area.w === 0 || area.h === 0) return null

  const out = createCanvas(area.w, area.h)
  const ctx = get2d(out)
  if (crop.shape !== 'rect' && crop.shape !== 'square') {
    ctx.translate(-area.x, -area.y)
    ctx.clip(new Path2D(shapePath(crop)))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  ctx.drawImage(source, area.x, area.y, area.w, area.h, 0, 0, area.w, area.h)
  return out
}
