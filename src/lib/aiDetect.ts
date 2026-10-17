import { aiApi } from '../api/ai'
import type { Rect } from '../types'
import { clampRect, createCanvas, findInkBox, get2d, hexToRgb, sampleColors } from './image'

const MAX_EDGE = 1536
const JPEG_QUALITY = 0.9
const MIN_BOX_SIZE = 6

export interface AiTextBox {
  text: string
  rect: Rect
}

/**
 * Shrinks the AI's rough box to the ink inside it. It never grows: searching beyond the box picks up
 * neighbouring words in tightly set lettering (e.g. "Ahead" under "Better").
 */
function snapToInk(base: HTMLCanvasElement, rough: Rect): Rect {
  const { ink, bg } = sampleColors(base, rough)
  return findInkBox(base, rough, hexToRgb(ink), hexToRgb(bg)) ?? rough
}

/**
 * Asks an AI vision model for every word in the image. It reads decorative, brush, script and tilted
 * lettering that Tesseract misses; its boxes are rough, so each one is snapped to the real ink.
 */
export async function aiDetectText(base: HTMLCanvasElement): Promise<AiTextBox[]> {
  const scale = Math.min(1, MAX_EDGE / Math.max(base.width, base.height))
  const small = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale))
  get2d(small).drawImage(base, 0, 0, small.width, small.height)

  const words = await aiApi.detect({ image: small.toDataURL('image/jpeg', JPEG_QUALITY), width: small.width, height: small.height })
  return words
    .filter((w) => w.text.trim())
    .map((w) => {
      const rough = clampRect(
        { x: w.x0 / scale, y: w.y0 / scale, w: (w.x1 - w.x0) / scale, h: (w.y1 - w.y0) / scale },
        base.width,
        base.height,
      )
      return { text: w.text.trim(), rect: rough }
    })
    .filter((w) => w.rect.w >= MIN_BOX_SIZE && w.rect.h >= MIN_BOX_SIZE)
    .map((w) => ({ ...w, rect: snapToInk(base, w.rect) }))
}
