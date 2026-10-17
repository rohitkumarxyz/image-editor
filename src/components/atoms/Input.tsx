import type { ComponentProps } from 'react'

export function Input({ className = '', ...rest }: ComponentProps<'input'>) {
  return <input className={`input ${className}`.trim()} {...rest} />
}
