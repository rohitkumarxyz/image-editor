'use client'

import { useEffect, useState } from 'react'
import { creditsApi, type LedgerEntry } from '../api/credits'
import { AppLink } from '../components/atoms/AppLink'
import { Button } from '../components/atoms/Button'
import { CreditsPanel } from '../components/organisms/account/CreditsPanel'
import { DeleteAccountPanel } from '../components/organisms/account/DeleteAccountPanel'
import { ProfilePanel } from '../components/organisms/account/ProfilePanel'
import { SecurityPanel } from '../components/organisms/account/SecurityPanel'
import { useApp } from '../state/appContext'
import { useRouter } from '../state/routerContext'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'
import { SiteLayout } from './SiteLayout'

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')

export function AccountPage() {
  const session = useSession()
  const { openAccount } = useApp()
  const { navigate } = useRouter()
  const toast = useToast()
  const [history, setHistory] = useState<LedgerEntry[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const user = session.user
  const credits = user?.credits ?? 0

  // Reload the history whenever the balance changes (e.g. after buying credits in the dialog).
  useEffect(() => {
    if (!user) return
    creditsApi.history().then(setHistory).catch((err: unknown) => setHistoryError(errorMessage(err)))
  }, [user, credits])

  if (session.loading) return <SiteLayout><div className="page account" /></SiteLayout>

  if (!user) {
    return (
      <SiteLayout>
        <div className="page legal">
          <h1>Your account</h1>
          <p>Sign in to see your credits, history and settings.</p>
          <div className="row">
            <Button variant="primary" className="btn--lg" onClick={() => openAccount('signin')}>Sign in</Button>
            <Button className="btn--lg" onClick={() => openAccount('signup')}>Create a free account</Button>
          </div>
        </div>
      </SiteLayout>
    )
  }

  return (
    <SiteLayout>
      <div className="page account">
        <nav className="account__nav" aria-label="Account sections">
          <AppLink href="#profile" className="menu__item">Profile</AppLink>
          <AppLink href="#credits" className="menu__item">Credits & history</AppLink>
          <AppLink href="#security" className="menu__item">Security</AppLink>
          <AppLink href="#delete" className="menu__item">Delete account</AppLink>
        </nav>
        <div className="account__main">
          <h1 className="account__title">Account settings</h1>
          <ProfilePanel
            key={user.name}
            name={user.name}
            email={user.email}
            onSave={async (name) => {
              await session.updateProfile({ name })
              toast.notify('success', 'Profile saved.')
            }}
          />
          <CreditsPanel credits={credits} history={history} historyError={historyError} onBuy={() => openAccount('credits')} />
          <SecurityPanel
            onSignOutEverywhere={async () => {
              await session.signOutEverywhere().catch((err: unknown) => toast.notify('error', errorMessage(err)))
              toast.notify('info', 'Signed out of all devices.')
              navigate('/')
            }}
          />
          <DeleteAccountPanel
            credits={credits}
            onDelete={async () => {
              await session.deleteAccount()
              toast.notify('info', 'Your account was deleted.')
              navigate('/')
            }}
          />
        </div>
      </div>
    </SiteLayout>
  )
}
