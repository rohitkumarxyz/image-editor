import type { SelectHTMLAttributes } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}

export function Select<T extends string>({ value, options, onChange, className = '', ...rest }: SelectProps<T>) {
  return (
    <select className={`input ${className}`.trim()} value={value} onChange={(e) => onChange(e.target.value as T)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
