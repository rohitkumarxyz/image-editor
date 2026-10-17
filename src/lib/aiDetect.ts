import { aiApi } from '../api/ai'
import type { Rect } from '../types'
import { clampRect, createCanvas, findInkBox, get2d, hexToRgb, padRect, sampleColors } from './image'

const MAX_EDGE = 1536
const JPEG_QUALITY = 0.9
const MIN_BOX_SIZE = 6
const AREA_MAX_SCALE = 3
const AREA_PAD = 8

export interface AiTextBox {
  text: string
  rect: Rect
}

function snapToInk(base: HTMLCanvasElement, rough: Rect): Rect {
  const { ink, bg } = sampleColors(base, rough)
  return findInkBox(base, rough, hexToRgb(ink), hexToRgb(bg)) ?? rough
}

export async function aiDetectText(base: HTMLCanvasElement, area: Rect = { x: 0, y: 0, w: base.width, h: base.height }, maxScale = 1): Promise<AiTextBox[]> {
  const scale = Math.min(maxScale, MAX_EDGE / Math.max(area.w, area.h))
  const small = createCanvas(Math.round(area.w * scale), Math.round(area.h * scale))
  get2d(small).drawImage(base, area.x, area.y, area.w, area.h, 0, 0, small.width, small.height)

  const words = await aiApi.detect({ image: small.toDataURL('image/jpeg', JPEG_QUALITY), width: small.width, height: small.height })
  return words
    .filter((w) => w.text.trim())
    .map((w) => {
      const rough = clampRect(
        { x: area.x + w.x0 / scale, y: area.y + w.y0 / scale, w: (w.x1 - w.x0) / scale, h: (w.y1 - w.y0) / scale },
        base.width,
        base.height,
      )
      return { text: w.text.trim(), rect: rough }
    })
    .filter((w) => w.rect.w >= MIN_BOX_SIZE && w.rect.h >= MIN_BOX_SIZE)
    .map((w) => ({ ...w, rect: snapToInk(base, w.rect) }))
}

export async function aiReadArea(base: HTMLCanvasElement, rect: Rect): Promise<AiTextBox | null> {
  const area = clampRect(padRect(rect, AREA_PAD), base.width, base.height)
  const words = await aiDetectText(base, area, AREA_MAX_SCALE)
  if (!words.length) return null
  const lineHeight = Math.min(...words.map((w) => w.rect.h))
  const ordered = [...words].sort((a, b) => Math.round((a.rect.y - b.rect.y) / lineHeight) || a.rect.x - b.rect.x)
  const x = Math.min(...words.map((w) => w.rect.x))
  const y = Math.min(...words.map((w) => w.rect.y))
  return {
    text: ordered.map((w) => w.text).join(' '),
    rect: { x, y, w: Math.max(...words.map((w) => w.rect.x + w.rect.w)) - x, h: Math.max(...words.map((w) => w.rect.y + w.rect.h)) - y },
  }
}
