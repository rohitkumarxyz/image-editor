'use client'

import { useEffect, useState } from 'react'
import { AppLink } from '../components/atoms/AppLink'
import { AuthForm } from '../components/organisms/AuthForm'
import { AuthShowcase } from '../components/organisms/AuthShowcase'
import { EXAMPLES } from '../lib/examples'
import { useApp } from '../state/appContext'
import { useRouter } from '../state/routerContext'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'

type Mode = 'signin' | 'signup'

const COPY: Record<Mode, { eyebrow: string; title: string; accent: string; lead: string; switchText: string; switchLink: string }> = {
  signin: {
    eyebrow: 'Welcome back',
    title: 'Sign in to',
    accent: 'keep editing.',
    lead: 'Your credits and edit history are waiting. One click with Google, no password to remember.',
    switchText: 'New here?',
    switchLink: 'Create a free account',
  },
  signup: {
    eyebrow: 'Free to start',
    title: 'Change any text,',
    accent: 'keep the font.',
    lead: 'Create your account with Google in one click. Detecting, editing and downloading stay free.',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
  },
}

/** Only same-site paths, so `?next=` can't send people to another website. */
function returnPath(): string {
  const next = new URLSearchParams(window.location.search).get('next') ?? '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function AuthPage({ mode }: { mode: Mode }) {
  const session = useSession()
  const { config } = useApp()
  const { navigate } = useRouter()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[mode]

  useEffect(() => {
    if (!session.loading && session.user && !busy) navigate(returnPath())
  }, [session.loading, session.user, busy, navigate])

  const signIn = async (credential: string) => {
    setBusy(true)
    setError(null)
    try {
      const isNew = await session.signInWithGoogle(credential)
      notify('success', isNew ? (config.signupCredits > 0 ? `Welcome! You have ${config.signupCredits} free AI edits.` : 'Welcome!') : 'Signed in.')
      navigate(returnPath())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  const other = mode === 'signin' ? 'signup' : 'signin'

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <AppLink href="/" className="brand">Image <span>Text</span> Editor</AppLink>
        <AppLink href="/" className="link small">Back to home</AppLink>
      </header>
      <main className="auth-page__grid">
        <section className="auth-page__panel">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1 className="auth-page__title">
            {copy.title} <em>{copy.accent}</em>
          </h1>
          <p className="lead">{copy.lead}</p>
          <div className="auth-card">
            <AuthForm
              mode={mode}
              freeCredits={config.signupCredits}
              googleClientId={config.googleClientId}
              busy={busy}
              error={error}
              onCredential={signIn}
              onError={setError}
              footer={
                <p className="small">
                  {copy.switchText}{' '}
                  <button type="button" className="link" onClick={() => navigate(`/${other}${window.location.search}`)}>
                    {copy.switchLink}
                  </button>
                </p>
              }
            />
          </div>
        </section>
        <section className="auth-page__visual">
          <AuthShowcase hero={EXAMPLES[0]} stack={EXAMPLES.slice(1)} />
        </section>
      </main>
    </div>
  )
}
