import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { toImagePoint } from '../../lib/pointer'
import { renderComposite } from '../../lib/render'
import type { CropState, Rect, TextRegion, Tool } from '../../types'
import { CropOverlay } from './CropOverlay'

interface EditorCanvasProps {
  base: HTMLCanvasElement
  regions: TextRegion[]
  selectedId: string | null
  tool: Tool
  showBoxes: boolean
  showOriginal: boolean
  zoom: number
  crop: CropState
  onCropChange: (patch: Partial<CropState>) => void
  onSelect: (id: string | null) => void
  onDrawRect: (rect: Rect) => void
  onMoveRect: (id: string, rect: Rect) => void
}

type Drag =
  | { kind: 'draw'; startX: number; startY: number; rect: Rect }
  | { kind: 'move'; id: string; startX: number; startY: number; origin: Rect; rect: Rect }

const MIN_DRAW = 4

function normalize(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

export function EditorCanvas(props: EditorCanvasProps) {
  const { base, regions, selectedId, tool, showBoxes, showOriginal, zoom } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [fontTick, setFontTick] = useState(0)

  useEffect(() => {
    const bump = () => setFontTick((t) => t + 1)
    document.fonts.addEventListener('loadingdone', bump)
    return () => document.fonts.removeEventListener('loadingdone', bump)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderComposite(canvas, base, showOriginal ? [] : regions)
  }, [base, regions, showOriginal, fontTick])

  const toImage = (e: PointerEvent) => toImagePoint(svgRef.current!, e.clientX, e.clientY, base.width, base.height)

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (tool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ kind: 'draw', startX: p.x, startY: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
      return
    }
    const hit = [...regions].reverse().find((r) => p.x >= r.rect.x && p.x <= r.rect.x + r.rect.w && p.y >= r.rect.y && p.y <= r.rect.y + r.rect.h)
    props.onSelect(hit?.id ?? null)
    if (hit && hit.id === selectedId) {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ kind: 'move', id: hit.id, startX: p.x, startY: p.y, origin: hit.rect, rect: hit.rect })
    }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = toImage(e)
    if (drag.kind === 'draw') {
      setDrag({ ...drag, rect: normalize(drag.startX, drag.startY, p.x, p.y) })
    } else {
      const rect = { ...drag.origin, x: drag.origin.x + p.x - drag.startX, y: drag.origin.y + p.y - drag.startY }
      setDrag({ ...drag, rect })
    }
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.kind === 'draw' && drag.rect.w >= MIN_DRAW && drag.rect.h >= MIN_DRAW) props.onDrawRect(drag.rect)
    if (drag.kind === 'move' && (drag.rect.x !== drag.origin.x || drag.rect.y !== drag.origin.y)) props.onMoveRect(drag.id, drag.rect)
    setDrag(null)
  }

  const rectFor = (r: TextRegion) => (drag?.kind === 'move' && drag.id === r.id ? drag.rect : r.rect)

  return (
    <div className="stage" style={{ width: base.width * zoom }}>
      <canvas ref={canvasRef} className="stage__canvas" />
      {tool === 'crop' ? (
        <CropOverlay imageW={base.width} imageH={base.height} crop={props.crop} onChange={props.onCropChange} />
      ) : (
        <svg
          ref={svgRef}
          className={`stage__overlay stage__overlay--${tool}`}
          viewBox={`0 0 ${base.width} ${base.height}`}
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {!showOriginal &&
            regions.map((r) => {
              const rect = rectFor(r)
              const selected = r.id === selectedId
              if (!showBoxes && !selected) return null
              return (
                <rect
                  key={r.id}
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  className={['box', selected && 'box--selected', r.edited && 'box--edited'].filter(Boolean).join(' ')}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          {drag?.kind === 'draw' && (
            <rect x={drag.rect.x} y={drag.rect.y} width={drag.rect.w} height={drag.rect.h} className="box box--draft" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      )}
    </div>
  )
}
