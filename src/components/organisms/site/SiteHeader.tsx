import type { ReactNode } from 'react'
import { AppLink } from '../../atoms/AppLink'

export function SiteHeader({ account }: { account: ReactNode }) {
  return (
    <header className="site-header">
      <div className="page site-header__inner">
        <AppLink href="/" className="brand">Image <span>Text</span> Editor</AppLink>
        <nav className="site-nav" aria-label="Main">
          <AppLink href="#examples">Examples</AppLink>
          <AppLink href="#how">How it works</AppLink>
          <AppLink href="#pricing">Pricing</AppLink>
          <AppLink href="#faq">FAQ</AppLink>
        </nav>
        {account}
      </div>
    </header>
  )
}
