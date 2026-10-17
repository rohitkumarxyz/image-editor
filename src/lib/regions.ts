import type { Rect, TextRegion, TextStyle } from '../types'
import { defaultFontFor } from './fonts'
import { matchFont } from './fontMatch'
import { sampleColors } from './image'
import { estimateFontSize } from './render'

let counter = 0
const nextId = () => `r${Date.now().toString(36)}${(counter++).toString(36)}`

export function buildStyle(base: HTMLCanvasElement, rect: Rect, text: string): TextStyle {
  const { bg, ink } = sampleColors(base, rect)
  const fontFamily = defaultFontFor(text)
  const font = matchFont(base, rect, text, ink, bg) ?? {
    fontFamily,
    fontWeight: 'normal',
    fontSize: estimateFontSize(text, fontFamily, 'normal', rect.h),
    letterSpacing: 0,
    rotation: 0,
  }
  return {
    ...font,
    color: ink,
    bgColor: bg,
    align: 'left',
    eraseMode: 'smart',
    padding: 2,
    offsetX: 0,
    offsetY: 0,
    fitWidth: false,
  }
}

export function createRegion(
  base: HTMLCanvasElement,
  rect: Rect,
  text: string,
  source: TextRegion['source'],
  confidence: number | null = null,
): TextRegion {
  const style = buildStyle(base, rect, text)
  return {
    id: nextId(),
    rect,
    originalText: text,
    text,
    confidence,
    source,
    style,
    initialStyle: style,
    edited: false,
    aiPatch: null,
  }
}

export function resetRegion(region: TextRegion): TextRegion {
  return { ...region, text: region.originalText, style: region.initialStyle, edited: false, aiPatch: null }
}
