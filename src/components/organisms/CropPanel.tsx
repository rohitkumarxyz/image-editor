import { hasAspectChoice } from '../../lib/crop'
import type { CropAspect, CropShape, CropState, Rect } from '../../types'
import { Button } from '../atoms/Button'
import { Select, type SelectOption } from '../atoms/Select'
import { Field } from '../molecules/Field'
import { NumberField } from '../molecules/NumberField'
import { PanelSection } from '../molecules/PanelSection'

const SHAPES: SelectOption<CropShape>[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'polygon', label: 'Polygon (click points)' },
  { value: 'freehand', label: 'Freehand (draw)' },
]

const ASPECTS: SelectOption<CropAspect>[] = [
  { value: 'free', label: 'Free' },
  { value: 'original', label: 'Original' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
]

const HINTS: Record<CropShape, string> = {
  rect: 'Drag on the image to draw the area. Drag inside to move it, drag a corner to resize.',
  square: 'Drag to draw a square. Drag inside to move it, drag a corner to resize.',
  rounded: 'Drag to draw the area, then set the corner radius.',
  circle: 'Drag to draw a circle. Drag inside to move it, drag a corner to resize.',
  ellipse: 'Drag to draw an ellipse. Drag inside to move it, drag a corner to resize.',
  polygon: 'Click to add points. Click the first point (or press Enter) to close. Drag points to adjust after closing.',
  freehand: 'Press and drag around the area. Release to close the shape.',
}

interface CropPanelProps {
  crop: CropState
  bounds: Rect | null
  onChange: (patch: Partial<CropState>) => void
  onApply: () => void
  onReset: () => void
  onCancel: () => void
}

export function CropPanel({ crop, bounds, onChange, onApply, onReset, onCancel }: CropPanelProps) {
  const openPolygon = crop.shape === 'polygon' && !crop.closed

  return (
    <PanelSection title="Crop">
      <Field label="Shape">
        <Select value={crop.shape} options={SHAPES} onChange={(shape) => onChange({ shape })} />
      </Field>
      {hasAspectChoice(crop.shape) && (
        <Field label="Ratio">
          <Select value={crop.aspect} options={ASPECTS} onChange={(aspect) => onChange({ aspect })} />
        </Field>
      )}
      {crop.shape === 'rounded' && (
        <NumberField label="Corner radius (%)" value={crop.radius} min={0} max={50} onChange={(radius) => onChange({ radius })} />
      )}
      <p className="muted small">{HINTS[crop.shape]}</p>
      <p className="muted small">{bounds ? `Result: ${Math.round(bounds.w)} × ${Math.round(bounds.h)} px` : 'Nothing selected yet.'}</p>
      {openPolygon && (
        <div className="row">
          <Button onClick={() => onChange({ closed: true })} disabled={crop.points.length < 3}>Close shape</Button>
          <Button variant="ghost" onClick={() => onChange({ points: crop.points.slice(0, -1) })} disabled={crop.points.length === 0}>
            Undo point
          </Button>
        </div>
      )}
      <div className="row">
        <Button variant="primary" onClick={onApply} disabled={!bounds}>Apply crop</Button>
        <Button variant="ghost" onClick={onReset}>Reset</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {crop.shape !== 'rect' && crop.shape !== 'square' && (
        <p className="muted small">Outside the shape becomes transparent in the PNG (white in the PDF).</p>
      )}
    </PanelSection>
  )
}
