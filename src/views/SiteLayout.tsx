import type { ReactNode } from 'react'
import { AccountBar } from '../components/organisms/AccountBar'
import { SiteFooter } from '../components/organisms/site/SiteFooter'
import { SiteHeader } from '../components/organisms/site/SiteHeader'
import { useApp } from '../state/appContext'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'

export function SiteLayout({ children }: { children: ReactNode }) {
  const session = useSession()
  const { config, openAccount } = useApp()
  const toast = useToast()
  return (
    <div className="site">
      <SiteHeader
        account={
          <AccountBar
            user={session.user}
            loading={session.loading}
            onSignIn={() => openAccount('signin')}
            onSignUp={() => openAccount('signup')}
            onBuy={() => openAccount('credits')}
            onHistory={() => openAccount('history')}
            onSignOut={() => session.signOut().then(() => toast.notify('info', 'Signed out.')).catch(() => undefined)}
          />
        }
      />
      <main>{children}</main>
      <SiteFooter businessName={config.businessName} supportEmail={config.supportEmail} />
    </div>
  )
}
