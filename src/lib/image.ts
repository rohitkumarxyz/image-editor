import type { Rect } from '../types'

export type RGB = [number, number, number]

const SAMPLE_BAND = 3
/** Pixels this far (as a share of the ink↔background distance) from the background count as ink, including faint brush streaks. */
const INK_EDGE_SHARE = 0.3

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser')
  return ctx
}

export function loadImageFile(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = createCanvas(img.naturalWidth, img.naturalHeight)
      get2d(canvas).drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image file'))
    }
    img.src = url
  })
}

export function rotateCanvas(src: HTMLCanvasElement, clockwise: boolean): HTMLCanvasElement {
  const out = createCanvas(src.height, src.width)
  const ctx = get2d(out)
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const x2 = Math.min(width, Math.ceil(rect.x + rect.w))
  const y2 = Math.min(height, Math.ceil(rect.y + rect.h))
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) }
}

export function padRect(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 }
}

function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Ink colours further apart than this mean two different print styles. */
const STYLE_COLOR_DISTANCE = 70
/**
 * Faded scans pull colours together, so also split when one ink is clearly coloured and the other is
 * neutral (grey/black), even if the plain colour distance is smaller.
 */
const STYLE_CHROMA_DIFFERENCE = 35
const STYLE_MIN_DISTANCE = 35

export function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Background = median colour of a thin ring around the box. Ink = the pixels inside that differ most from it. */
export function sampleColors(base: HTMLCanvasElement, rect: Rect): { bg: string; ink: string } {
  const outer = clampRect(padRect(rect, SAMPLE_BAND + 1), base.width, base.height)
  const inner = clampRect(rect, base.width, base.height)
  if (outer.w === 0 || outer.h === 0) return { bg: '#ffffff', ink: '#000000' }

  const data = get2d(base).getImageData(outer.x, outer.y, outer.w, outer.h).data
  const ring: RGB[] = []
  const inside: RGB[] = []
  for (let y = 0; y < outer.h; y++) {
    for (let x = 0; x < outer.w; x++) {
      const gx = outer.x + x
      const gy = outer.y + y
      const i = (y * outer.w + x) * 4
      const px: RGB = [data[i], data[i + 1], data[i + 2]]
      const isInside = gx >= inner.x && gx < inner.x + inner.w && gy >= inner.y && gy < inner.y + inner.h
      if (isInside) inside.push(px)
      else ring.push(px)
    }
  }

  const bg: RGB = [0, 1, 2].map((c) => median(ring.map((p) => p[c]))) as RGB
  if (inside.length === 0) return { bg: toHex(bg), ink: '#000000' }

  const byDistance = inside
    .map((p) => ({ p, d: colorDistance(p, bg) }))
    .sort((a, b) => b.d - a.d)
  const top = byDistance.slice(0, Math.max(1, Math.floor(byDistance.length * 0.12)))
  const ink: RGB = [0, 1, 2].map((c) => top.reduce((sum, t) => sum + t.p[c], 0) / top.length) as RGB
  return { bg: toHex(bg), ink: toHex(ink) }
}

/**
 * Fills the box by blending the pixels just outside its edges (top↔bottom and left↔right),
 * so paper texture, lighting and tint carry through instead of leaving a flat patch.
 */
export function smartFill(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, area: Rect, colors?: { ink: string; bg: string }): void {
  const r = clampRect(area, base.width, base.height)
  if (r.w === 0 || r.h === 0) return

  const win = clampRect(padRect(r, SAMPLE_BAND), base.width, base.height)
  const src = get2d(base).getImageData(win.x, win.y, win.w, win.h).data
  const ink = colors && hexToRgb(colors.ink)
  const bg = colors && hexToRgb(colors.bg)
  const at = (gx: number, gy: number, c: number) => {
    const lx = Math.min(win.w - 1, Math.max(0, gx - win.x))
    const ly = Math.min(win.h - 1, Math.max(0, gy - win.y))
    const i = (ly * win.w + lx) * 4
    // A neighbour's letter touching the edge would be smeared across the fill; use the background there instead.
    if (ink && bg && colorDistance([src[i], src[i + 1], src[i + 2]], bg) > INK_EDGE_SHARE * colorDistance(ink, bg)) return bg[c]
    return src[i + c]
  }
  const edge = (pick: (k: number) => [number, number]) => {
    const out: RGB = [0, 0, 0]
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let k = 1; k <= SAMPLE_BAND; k++) {
        const [gx, gy] = pick(k)
        sum += at(gx, gy, c)
      }
      out[c] = sum / SAMPLE_BAND
    }
    return out
  }

  const top = Array.from({ length: r.w }, (_, i) => edge((k) => [r.x + i, r.y - k]))
  const bottom = Array.from({ length: r.w }, (_, i) => edge((k) => [r.x + i, r.y + r.h - 1 + k]))
  const left = Array.from({ length: r.h }, (_, j) => edge((k) => [r.x - k, r.y + j]))
  const right = Array.from({ length: r.h }, (_, j) => edge((k) => [r.x + r.w - 1 + k, r.y + j]))

  const vWeight = r.w / (r.w + r.h)
  const out = ctx.createImageData(r.w, r.h)
  for (let j = 0; j < r.h; j++) {
    const ty = (j + 0.5) / r.h
    for (let i = 0; i < r.w; i++) {
      const tx = (i + 0.5) / r.w
      const o = (j * r.w + i) * 4
      for (let c = 0; c < 3; c++) {
        const vertical = top[i][c] * (1 - ty) + bottom[i][c] * ty
        const horizontal = left[j][c] * (1 - tx) + right[j][c] * tx
        out.data[o + c] = vertical * vWeight + horizontal * (1 - vWeight)
      }
      out.data[o + 3] = 255
    }
  }
  ctx.putImageData(out, r.x, r.y)
}

export function pixelDistance(data: Uint8ClampedArray, i: number, c: RGB): number {
  return Math.hypot(data[i] - c[0], data[i + 1] - c[1], data[i + 2] - c[2])
}

/** Tight box around the pixels inside `rect` that look like ink rather than background. */
export function findInkBox(base: HTMLCanvasElement, rect: Rect, ink: RGB, bg: RGB): Rect | null {
  const r = clampRect(rect, base.width, base.height)
  if (r.w === 0 || r.h === 0) return null
  const data = get2d(base).getImageData(r.x, r.y, r.w, r.h).data
  let minX = r.w
  let minY = r.h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4
      if (pixelDistance(data, i, ink) >= pixelDistance(data, i, bg)) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { x: r.x + minX, y: r.y + minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function chroma([r, g, b]: RGB): number {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

/** True when two ink colours look like different print styles (e.g. green form text vs black typed value). */
export function differentInk(a: string, b: string): boolean {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const distance = colorDistance(ca, cb)
  if (distance > STYLE_COLOR_DISTANCE) return true
  return distance > STYLE_MIN_DISTANCE && Math.abs(chroma(ca) - chroma(cb)) > STYLE_CHROMA_DIFFERENCE
}
