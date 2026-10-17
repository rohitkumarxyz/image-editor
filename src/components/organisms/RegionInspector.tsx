import { useEffect, useRef } from 'react'
import { FONT_OPTIONS } from '../../lib/fonts'
import type { AiStatus, EraseMode, FontWeight, Rect, TextAlign, TextRegion, TextStyle } from '../../types'
import { Button } from '../atoms/Button'
import { Checkbox } from '../atoms/Checkbox'
import { ColorInput } from '../atoms/ColorInput'
import { Input } from '../atoms/Input'
import { Select, type SelectOption } from '../atoms/Select'
import { Field } from '../molecules/Field'
import { NumberField } from '../molecules/NumberField'
import { PanelSection } from '../molecules/PanelSection'

export interface RegionPatch {
  text?: string
  rect?: Rect
  style?: Partial<TextStyle>
}

interface RegionInspectorProps {
  region: TextRegion
  ai: AiStatus
  aiCost: number
  signedIn: boolean
  onChange: (patch: RegionPatch) => void
  onAiEdit: () => void
  onResample: () => void
  onAutoSize: () => void
  onReset: () => void
  onDelete: () => void
}

const WEIGHTS: SelectOption<FontWeight>[] = [
  { value: 'normal', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
]
const ALIGNS: SelectOption<TextAlign>[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]
const ERASE_MODES: SelectOption<EraseMode>[] = [
  { value: 'smart', label: 'Smart (blend surroundings)' },
  { value: 'solid', label: 'Solid colour' },
]

export function RegionInspector({ region, ai, aiCost, signedIn, onChange, onAiEdit, onResample, onAutoSize, onReset, onDelete }: RegionInspectorProps) {
  const textRef = useRef<HTMLInputElement>(null)
  const { style, rect } = region
  const setStyle = (s: Partial<TextStyle>) => onChange({ style: s })
  const setRect = (r: Partial<Rect>) => onChange({ rect: { ...rect, ...r } })
  const fontOptions = FONT_OPTIONS.some((f) => f.value === style.fontFamily)
    ? FONT_OPTIONS
    : [...FONT_OPTIONS, { value: style.fontFamily, label: style.fontFamily }]

  useEffect(() => {
    textRef.current?.focus()
    textRef.current?.select()
  }, [region.id])

  return (
    <>
      <PanelSection
        title="Text"
        actions={region.edited ? <span className="badge badge--edited">edited</span> : <span className="badge">original</span>}
      >
        <Field label="New text" hint={region.originalText ? `Detected: “${region.originalText}”` : 'Manual box'}>
          <Input ref={textRef} value={region.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Type replacement text" />
        </Field>
        <Button variant="primary" className="btn--block" onClick={onAiEdit} disabled={ai.running || !region.text.trim()}>
          {ai.running
            ? 'AI is redrawing…'
            : `${region.aiPatch ? 'Try again with AI' : 'AI exact match'} · ${aiCost} credit${aiCost === 1 ? '' : 's'}`}
        </Button>
        {ai.running && <p className="muted small">Redrawing in the original lettering. This can take up to a minute.</p>}
        {!ai.running && !ai.error && (
          <p className="muted small">
            {region.aiPatch
              ? 'Done by AI. Compare with the original, then download.'
              : signedIn
                ? 'Your text is already drawn in a matching font. AI exact match makes it pixel-perfect.'
                : 'Your text is already drawn in a matching font. For a pixel-perfect result, use AI exact match (free trial edits with an account).'}
          </p>
        )}
        {ai.error && <p className="error">{ai.error}</p>}
        <div className="row">
          <Button variant="ghost" onClick={() => onChange({ text: '' })} title="Remove the text and fill the background">Erase text</Button>
          <Button variant="ghost" onClick={onReset}>Reset</Button>
          <Button variant="danger" onClick={onDelete}>Delete box</Button>
        </div>
      </PanelSection>

      <details className="fine-tune">
        <summary>Fine-tune: font, colour, position</summary>

        <PanelSection title="Font">
          <Field label="Family">
            <Select value={style.fontFamily} options={fontOptions} onChange={(fontFamily) => setStyle({ fontFamily })} />
          </Field>
          <div className="grid-2">
            <NumberField label="Size (px)" value={style.fontSize} min={4} max={1000} onChange={(fontSize) => setStyle({ fontSize })} />
            <Field label="Weight">
              <Select value={style.fontWeight} options={WEIGHTS} onChange={(fontWeight) => setStyle({ fontWeight })} />
            </Field>
            <NumberField label="Letter spacing (px)" value={style.letterSpacing} step={0.5} onChange={(letterSpacing) => setStyle({ letterSpacing })} />
            <Field label="Align">
              <Select value={style.align} options={ALIGNS} onChange={(align) => setStyle({ align })} />
            </Field>
            <Field label="Text colour">
              <ColorInput value={style.color} onChange={(color) => setStyle({ color })} />
            </Field>
          </div>
          <Checkbox checked={style.fitWidth} label="Stretch text to box width" onChange={(fitWidth) => setStyle({ fitWidth })} />
          <div className="row">
            <Button onClick={onAutoSize}>Auto size</Button>
            <Button onClick={onResample}>Re-pick colours</Button>
          </div>
        </PanelSection>

        <PanelSection title="Background erase">
          <Field label="Mode">
            <Select value={style.eraseMode} options={ERASE_MODES} onChange={(eraseMode) => setStyle({ eraseMode })} />
          </Field>
          <div className="grid-2">
            {style.eraseMode === 'solid' && (
              <Field label="Fill colour">
                <ColorInput value={style.bgColor} onChange={(bgColor) => setStyle({ bgColor })} />
              </Field>
            )}
            <NumberField label="Padding (px)" value={style.padding} min={0} max={50} onChange={(padding) => setStyle({ padding })} />
          </div>
        </PanelSection>

        <PanelSection title="Position">
          <div className="grid-2">
            <NumberField label="Text nudge X" value={style.offsetX} onChange={(offsetX) => setStyle({ offsetX })} />
            <NumberField label="Text nudge Y" value={style.offsetY} onChange={(offsetY) => setStyle({ offsetY })} />
            <NumberField label="Rotation (°)" value={style.rotation} min={-45} max={45} step={0.5} onChange={(rotation) => setStyle({ rotation })} />
            <NumberField label="Box X" value={rect.x} onChange={(x) => setRect({ x })} />
            <NumberField label="Box Y" value={rect.y} onChange={(y) => setRect({ y })} />
            <NumberField label="Box width" value={rect.w} min={1} onChange={(w) => setRect({ w })} />
            <NumberField label="Box height" value={rect.h} min={1} onChange={(h) => setRect({ h })} />
          </div>
          <p className="muted small">Tip: drag the selected box on the image to move it. Arrow keys nudge the text (click the image first so the text field is not focused).</p>
        </PanelSection>
      </details>
    </>
  )
}
