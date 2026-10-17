import type { ReactNode } from 'react'
import { GoogleSignInButton } from '../molecules/GoogleSignInButton'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  freeCredits: number
  googleClientId: string
  busy: boolean
  error: string | null
  onCredential: (credential: string) => void
  onError: (message: string) => void
  footer?: ReactNode
}

export function AuthForm({ mode, freeCredits, googleClientId, busy, error, onCredential, onError, footer }: AuthFormProps) {
  return (
    <div className="form">
      {freeCredits > 0 && <p className="muted small">New accounts get {freeCredits} free AI edits.</p>}
      <div className="auth-google">
        <GoogleSignInButton clientId={googleClientId} text={mode === 'signup' ? 'signup_with' : 'signin_with'} onCredential={onCredential} onError={onError} />
      </div>
      {busy && <p className="muted small">Signing you in…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {footer}
      <p className="muted small">
        By continuing you agree to our <a className="link" href="/terms">Terms & Conditions</a> and <a className="link" href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  )
}
