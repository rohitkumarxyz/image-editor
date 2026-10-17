import { useEffect, useRef } from 'react'
import { renderGoogleButton } from '../../lib/googleIdentity'

interface GoogleSignInButtonProps {
  clientId: string
  text: 'signin_with' | 'signup_with'
  onCredential: (credential: string) => void
  onError: (message: string) => void
}

const BUTTON_WIDTH = 280

export function GoogleSignInButton({ clientId, text, onCredential, onError }: GoogleSignInButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Google keeps the first callback it was given, so the latest handlers are read through refs.
  const handlers = useRef({ onCredential, onError })
  useEffect(() => {
    handlers.current = { onCredential, onError }
  })

  useEffect(() => {
    if (!ref.current || !clientId) return
    renderGoogleButton(ref.current, { clientId, text, width: BUTTON_WIDTH, onCredential: (c) => handlers.current.onCredential(c) }).catch((err: unknown) =>
      handlers.current.onError(err instanceof Error ? err.message : 'Could not load Google sign-in.'),
    )
  }, [clientId, text])

  return <div ref={ref} />
}
