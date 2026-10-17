import { Dialog } from '../molecules/Dialog'
import { GoogleSignInButton } from '../molecules/GoogleSignInButton'

export type AuthMode = 'signin' | 'signup'

interface AuthDialogProps {
  open: boolean
  mode: AuthMode
  freeCredits: number
  googleClientId: string
  busy: boolean
  error: string | null
  onCredential: (credential: string) => void
  onError: (message: string) => void
  onClose: () => void
}

export function AuthDialog({ open, mode, freeCredits, googleClientId, busy, error, onCredential, onError, onClose }: AuthDialogProps) {
  const signUp = mode === 'signup'

  return (
    <Dialog open={open} title={signUp ? 'Create your account' : 'Sign in'} onClose={onClose}>
      <div className="form">
        {freeCredits > 0 && <p className="muted small">New accounts get {freeCredits} free AI edits.</p>}
        {open && <GoogleSignInButton clientId={googleClientId} text={signUp ? 'signup_with' : 'signin_with'} onCredential={onCredential} onError={onError} />}
        {busy && <p className="muted small">Signing you in…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}
