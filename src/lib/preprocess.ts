import { createCanvas, get2d } from './image'

const THRESHOLD_SENSITIVITY = 0.15

/**
 * Makes a black-and-white copy that is easier to read for OCR (same size, so boxes map 1:1):
 * - uses the darkest colour channel, so coloured ink (green, blue, red) still reads as dark
 * - adaptive threshold (Bradley): each pixel is compared with its neighbourhood mean,
 *   which cancels uneven lighting from phone photos
 */
export function prepareForOcr(src: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = src
  const pixels = get2d(src).getImageData(0, 0, width, height)
  const data = pixels.data

  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = Math.min(data[i], data[i + 1], data[i + 2])
  }

  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x]
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum
    }
  }

  const half = Math.max(8, Math.round(Math.min(width, height) / 40))
  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - half)
    const y2 = Math.min(height, y + half + 1)
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half)
      const x2 = Math.min(width, x + half + 1)
      const sum =
        integral[y2 * (width + 1) + x2] - integral[y1 * (width + 1) + x2] - integral[y2 * (width + 1) + x1] + integral[y1 * (width + 1) + x1]
      const mean = sum / ((x2 - x1) * (y2 - y1))
      const v = gray[y * width + x] < mean * (1 - THRESHOLD_SENSITIVITY) ? 0 : 255
      const i = (y * width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }

  const out = createCanvas(width, height)
  get2d(out).putImageData(pixels, 0, 0)
  return out
}
