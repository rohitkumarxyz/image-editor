import { Dialog } from '../molecules/Dialog'
import { AuthForm } from './AuthForm'

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

export function AuthDialog({ open, mode, onClose, ...form }: AuthDialogProps) {
  return (
    <Dialog open={open} title={mode === 'signup' ? 'Create your account' : 'Sign in'} onClose={onClose}>
      {open && <AuthForm mode={mode} {...form} />}
    </Dialog>
  )
}
