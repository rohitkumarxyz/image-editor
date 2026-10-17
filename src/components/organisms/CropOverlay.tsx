import { useRef, useState, type PointerEvent } from 'react'
import { aspectRatio, isBoxShape, shapePath } from '../../lib/crop'
import { toImagePoint } from '../../lib/pointer'
import type { CropState, Point, Rect } from '../../types'

interface CropOverlayProps {
  imageW: number
  imageH: number
  crop: CropState
  onChange: (patch: Partial<CropState>) => void
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

type Drag =
  | { kind: 'box'; anchor: Point }
  | { kind: 'move'; start: Point; origin: Rect }
  | { kind: 'vertex'; index: number }
  | { kind: 'freehand' }

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const HANDLE_RATIO = 0.009
const MIN_FREEHAND_STEP = 2

function cornerPoint(r: Rect, c: Corner): Point {
  return { x: c.endsWith('w') ? r.x : r.x + r.w, y: c.startsWith('n') ? r.y : r.y + r.h }
}

function opposite(c: Corner): Corner {
  return `${c.startsWith('n') ? 's' : 'n'}${c.endsWith('w') ? 'e' : 'w'}` as Corner
}

function boxFrom(anchor: Point, p: Point, aspect: number | null, imageW: number, imageH: number): Rect {
  const dirX = p.x >= anchor.x ? 1 : -1
  const dirY = p.y >= anchor.y ? 1 : -1
  let w = Math.abs(p.x - anchor.x)
  let h = Math.abs(p.y - anchor.y)
  if (aspect) {
    if (w / Math.max(h, 1e-6) > aspect) h = w / aspect
    else w = h * aspect
  }
  const maxW = dirX > 0 ? imageW - anchor.x : anchor.x
  const maxH = dirY > 0 ? imageH - anchor.y : anchor.y
  const scale = Math.min(1, maxW / Math.max(w, 1e-6), maxH / Math.max(h, 1e-6))
  w *= scale
  h *= scale
  return { x: dirX > 0 ? anchor.x : anchor.x - w, y: dirY > 0 ? anchor.y : anchor.y - h, w, h }
}

function clampPoint(p: Point, imageW: number, imageH: number): Point {
  return { x: Math.min(imageW, Math.max(0, p.x)), y: Math.min(imageH, Math.max(0, p.y)) }
}

export function CropOverlay({ imageW, imageH, crop, onChange }: CropOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const handle = Math.max(imageW, imageH) * HANDLE_RATIO
  const aspect = aspectRatio(crop, imageW, imageH)
  const boxShape = isBoxShape(crop.shape)
  const path = shapePath(crop)

  const pointOf = (e: PointerEvent) => clampPoint(toImagePoint(svgRef.current!, e.clientX, e.clientY, imageW, imageH), imageW, imageH)
  const capture = (e: PointerEvent) => svgRef.current!.setPointerCapture(e.pointerId)

  const inside = (p: Point, r: Rect | null) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = pointOf(e)
    capture(e)
    if (boxShape) {
      if (inside(p, crop.rect)) setDrag({ kind: 'move', start: p, origin: crop.rect! })
      else {
        setDrag({ kind: 'box', anchor: p })
        onChange({ rect: { x: p.x, y: p.y, w: 0, h: 0 } })
      }
      return
    }
    if (crop.shape === 'freehand') {
      setDrag({ kind: 'freehand' })
      onChange({ points: [p], closed: false })
      return
    }
    if (crop.closed) return
    const first = crop.points[0]
    if (first && crop.points.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= handle * 1.5) onChange({ closed: true })
    else onChange({ points: [...crop.points, p] })
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = pointOf(e)
    if (drag.kind === 'box') onChange({ rect: boxFrom(drag.anchor, p, aspect, imageW, imageH) })
    if (drag.kind === 'move') {
      const { origin } = drag
      const x = Math.min(imageW - origin.w, Math.max(0, origin.x + p.x - drag.start.x))
      const y = Math.min(imageH - origin.h, Math.max(0, origin.y + p.y - drag.start.y))
      onChange({ rect: { ...origin, x, y } })
    }
    if (drag.kind === 'vertex') onChange({ points: crop.points.map((pt, i) => (i === drag.index ? p : pt)) })
    if (drag.kind === 'freehand') {
      const last = crop.points[crop.points.length - 1]
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_FREEHAND_STEP) onChange({ points: [...crop.points, p] })
    }
  }

  const onPointerUp = () => {
    if (drag?.kind === 'freehand') onChange({ closed: crop.points.length >= 3 })
    setDrag(null)
  }

  const startResize = (e: PointerEvent, corner: Corner) => {
    e.stopPropagation()
    capture(e)
    setDrag({ kind: 'box', anchor: cornerPoint(crop.rect!, opposite(corner)) })
  }

  const startVertex = (e: PointerEvent, index: number) => {
    if (!crop.closed) return
    e.stopPropagation()
    capture(e)
    setDrag({ kind: 'vertex', index })
  }

  const showCutout = boxShape ? !!crop.rect : crop.closed

  return (
    <svg
      ref={svgRef}
      className={`stage__overlay crop-overlay crop-overlay--${crop.shape}`}
      viewBox={`0 0 ${imageW} ${imageH}`}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <path className="crop-dim" fillRule="evenodd" d={`M0 0 H${imageW} V${imageH} H0 Z ${showCutout ? path : ''}`} />
      {path && <path className="crop-outline" d={path} vectorEffect="non-scaling-stroke" />}

      {boxShape && crop.rect && crop.shape !== 'rect' && crop.shape !== 'square' && (
        <rect className="crop-guide" x={crop.rect.x} y={crop.rect.y} width={crop.rect.w} height={crop.rect.h} vectorEffect="non-scaling-stroke" />
      )}
      {boxShape &&
        crop.rect &&
        CORNERS.map((c) => {
          const p = cornerPoint(crop.rect!, c)
          return (
            <rect
              key={c}
              className={`crop-handle crop-handle--${c}`}
              x={p.x - handle}
              y={p.y - handle}
              width={handle * 2}
              height={handle * 2}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(e) => startResize(e, c)}
            />
          )
        })}

      {crop.shape === 'polygon' &&
        crop.points.map((p, i) => (
          <circle
            key={i}
            className={['crop-handle', i === 0 && !crop.closed && 'crop-handle--first'].filter(Boolean).join(' ')}
            cx={p.x}
            cy={p.y}
            r={i === 0 && !crop.closed ? handle * 1.5 : handle}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => startVertex(e, i)}
          />
        ))}
    </svg>
  )
}
