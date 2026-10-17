import type { TextRegion } from '../types'
import { scoreFonts, toFontMatch, type CandidateScore } from './fontMatch'
import { hasDevanagari } from './fonts'
import { colorDistance, hexToRgb } from './image'

const MAX_COLOR_DISTANCE = 60
const MAX_SIZE_RATIO = 1.3
const MAX_LINE_GAP = 1.5

function sameBlock(a: TextRegion, b: TextRegion): boolean {
  if (a.style.rotation || b.style.rotation) return false
  if (hasDevanagari(a.originalText) !== hasDevanagari(b.originalText)) return false
  if (colorDistance(hexToRgb(a.style.color), hexToRgb(b.style.color)) > MAX_COLOR_DISTANCE) return false

  const sizeRatio = Math.max(a.style.fontSize, b.style.fontSize) / Math.min(a.style.fontSize, b.style.fontSize)
  if (sizeRatio > MAX_SIZE_RATIO) return false

  const [top, bottom] = a.rect.y <= b.rect.y ? [a.rect, b.rect] : [b.rect, a.rect]
  const gap = bottom.y - (top.y + top.h)
  if (gap > MAX_LINE_GAP * Math.max(top.h, bottom.h)) return false

  const overlap = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x)
  return overlap > 0
}

function findBlocks(regions: TextRegion[]): TextRegion[][] {
  const parent = regions.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      if (sameBlock(regions[i], regions[j])) parent[root(j)] = root(i)
    }
  }
  const blocks = new Map<number, TextRegion[]>()
  regions.forEach((r, i) => blocks.set(root(i), [...(blocks.get(root(i)) ?? []), r]))
  return [...blocks.values()]
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const keyOf = (c: CandidateScore) => `${c.family}|${c.weight}`

export function unifyBlockFonts(base: HTMLCanvasElement, regions: TextRegion[]): TextRegion[] {
  const updated = new Map<string, TextRegion>()

  for (const block of findBlocks(regions.filter((r) => !r.edited && r.originalText.trim()))) {
    if (block.length < 2) continue
    const scored = block.map((r) => ({ region: r, scores: scoreFonts(base, r.rect, r.originalText, r.style.color, r.style.bgColor) }))
    if (scored.some((s) => !s.scores)) continue

    const totals = new Map<string, number>()
    for (const { scores } of scored) {
      for (const c of scores!.candidates) totals.set(keyOf(c), (totals.get(keyOf(c)) ?? 0) + c.score)
    }
    const bestKey = [...totals.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0]

    const choices = scored.map(({ region, scores }) => ({ region, choice: scores!.candidates.find((c) => keyOf(c) === bestKey) }))
    if (choices.some((c) => !c.choice)) continue
    const sizes = choices.map(({ region, choice }) => toFontMatch(choice!, region.originalText, region.rect.h, 0).fontSize)
    const fontSize = median(sizes)

    for (const { region, choice } of choices) {
      const style = { ...region.style, ...toFontMatch(choice!, region.originalText, region.rect.h, 0, fontSize) }
      updated.set(region.id, { ...region, style, initialStyle: style })
    }
  }

  return regions.map((r) => updated.get(r.id) ?? r)
}
