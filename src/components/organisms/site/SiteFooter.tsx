import { AppLink } from '../../atoms/AppLink'

const YEAR = new Date().getFullYear()

export function SiteFooter({ businessName, supportEmail }: { businessName: string; supportEmail: string }) {
  return (
    <footer className="site-footer">
      <div className="page site-footer__inner">
        <div>
          <AppLink href="/" className="brand brand--small">Image <span>Text</span> Editor</AppLink>
          <p>© {YEAR} {businessName}</p>
        </div>
        <nav aria-label="Footer">
          <AppLink href="/editor">Editor</AppLink>
          <AppLink href="#pricing">Pricing</AppLink>
          <AppLink href="/terms">Terms</AppLink>
          <AppLink href="/privacy">Privacy</AppLink>
          <AppLink href="/refunds">Refunds</AppLink>
          <AppLink href="/contact">Contact</AppLink>
          {supportEmail && <a href={`mailto:${supportEmail}`}>{supportEmail}</a>}
        </nav>
      </div>
    </footer>
  )
}
