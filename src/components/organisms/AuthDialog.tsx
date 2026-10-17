import { useState, type FormEvent } from 'react'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { PasswordInput } from '../atoms/PasswordInput'
import { Dialog } from '../molecules/Dialog'
import { Field } from '../molecules/Field'

export type AuthMode = 'signin' | 'signup'

interface AuthDialogProps {
  open: boolean
  mode: AuthMode
  freeCredits: number
  supportEmail: string
  busy: boolean
  error: string | null
  onModeChange: (mode: AuthMode) => void
  onSubmit: (values: { name: string; email: string; password: string }) => void
  onClose: () => void
}

const MIN_PASSWORD = 8

export function AuthDialog({ open, mode, freeCredits, supportEmail, busy, error, onModeChange, onSubmit, onClose }: AuthDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = mode === 'signup'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ name: name.trim(), email: email.trim(), password })
  }

  return (
    <Dialog open={open} title={signUp ? 'Create your account' : 'Sign in'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate={false}>
        {signUp && freeCredits > 0 && (
          <p className="muted small">You get {freeCredits} free AI edits when you sign up.</p>
        )}
        {signUp && (
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
          </Field>
        )}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} />
        </Field>
        <Field label="Password" hint={signUp ? `At least ${MIN_PASSWORD} characters.` : undefined}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signUp ? 'new-password' : 'current-password'}
            required
            minLength={signUp ? MIN_PASSWORD : 1}
            maxLength={128}
          />
        </Field>
        {!signUp && supportEmail && (
          <a className="link small" href={`mailto:${supportEmail}?subject=${encodeURIComponent('Password reset')}`}>
            Forgot password?
          </a>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}
        </Button>
        <p className="muted small">
          {signUp ? 'Already have an account? ' : 'New here? '}
          <button type="button" className="link" onClick={() => onModeChange(signUp ? 'signin' : 'signup')}>
            {signUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </Dialog>
  )
}
