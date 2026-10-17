import { Button } from '../atoms/Button'
import { Checkbox } from '../atoms/Checkbox'

interface CanvasControlsProps {
  zoom: number
  showBoxes: boolean
  onZoomChange: (zoom: number) => void
  onFit: () => void
  onShowBoxesChange: (show: boolean) => void
  onCompare: (showOriginal: boolean) => void
}

const ZOOM_STEP = 1.25
const MIN_ZOOM = 0.1
const MAX_ZOOM = 3

export function CanvasControls({ zoom, showBoxes, onZoomChange, onFit, onShowBoxesChange, onCompare }: CanvasControlsProps) {
  return (
    <div className="canvas-controls">
      <Button
        title="Press and hold to see the original image"
        onPointerDown={() => onCompare(true)}
        onPointerUp={() => onCompare(false)}
        onPointerLeave={() => onCompare(false)}
        onKeyDown={(e) => e.key === ' ' && onCompare(true)}
        onKeyUp={(e) => e.key === ' ' && onCompare(false)}
      >
        Hold to compare
      </Button>
      <Checkbox checked={showBoxes} label="Boxes" onChange={onShowBoxesChange} />
      <span className="canvas-controls__divider" aria-hidden="true" />
      <Button aria-label="Zoom out" title="Zoom out" onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom / ZOOM_STEP))}>−</Button>
      <span className="muted small zoom-value">{Math.round(zoom * 100)}%</span>
      <Button aria-label="Zoom in" title="Zoom in" onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom * ZOOM_STEP))}>+</Button>
      <Button onClick={onFit}>Fit</Button>
    </div>
  )
}
