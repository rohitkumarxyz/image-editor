import { Input } from '../atoms/Input'
import { Field } from './Field'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function NumberField({ label, value, onChange, min, max, step = 1 }: NumberFieldProps) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = parseFloat(e.target.value)
          if (!Number.isNaN(next)) onChange(next)
        }}
      />
    </Field>
  )
}
