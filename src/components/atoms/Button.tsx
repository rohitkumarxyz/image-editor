import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  active?: boolean
}

export function Button({ variant = 'secondary', active = false, className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, active ? 'btn--active' : '', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
