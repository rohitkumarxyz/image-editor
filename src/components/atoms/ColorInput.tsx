interface ColorInputProps {
  value: string
  onChange: (value: string) => void
}

export function ColorInput({ value, onChange }: ColorInputProps) {
  return (
    <span className="color-input">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <code>{value}</code>
    </span>
  )
}
