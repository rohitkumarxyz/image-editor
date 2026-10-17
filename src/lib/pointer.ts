import type { Point } from '../types'

export function toImagePoint(overlay: Element, clientX: number, clientY: number, imageW: number, imageH: number): Point {
  const box = overlay.getBoundingClientRect()
  return {
    x: ((clientX - box.left) * imageW) / box.width,
    y: ((clientY - box.top) * imageH) / box.height,
  }
}
