'use client'

import { AppLink } from '../components/atoms/AppLink'
import { SiteLayout } from './SiteLayout'

export function NotFoundPage() {
  return (
    <SiteLayout>
      <div className="page legal">
        <h1>Page not found</h1>
        <p>This page doesn't exist or has moved.</p>
        <div className="row">
          <AppLink href="/editor" variant="primary" className="btn--lg">Open the editor</AppLink>
          <AppLink href="/" variant="secondary" className="btn--lg">Go to the home page</AppLink>
        </div>
      </div>
    </SiteLayout>
  )
}
