import { useState, type ComponentProps } from 'react'

/** Password field with a show/hide toggle, so people can check what they typed (common on phones). */
export function PasswordInput({ className = '', ...rest }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="password-input">
      <input type={visible ? 'text' : 'password'} className={`input ${className}`.trim()} {...rest} />
      <button type="button" className="password-input__toggle" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((v) => !v)}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  )
}
