interface CheckboxProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

export function Checkbox({ checked, label, onChange }: CheckboxProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
