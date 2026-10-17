import { BUSINESS } from '../../../lib/business'
import { AppLink } from '../../atoms/AppLink'

const YEAR = new Date().getFullYear()

export function SiteFooter({ businessName, supportEmail }: { businessName: string; supportEmail: string }) {
  return (
    <footer className="site-footer">
      <div className="page site-footer__inner">
        <div>
          <AppLink href="/" className="brand brand--small">Image <span>Text</span> Editor</AppLink>
          <p>© {YEAR} {businessName} · a <a href={BUSINESS.website}>{BUSINESS.operator}</a> product</p>
          <p>
            {supportEmail && <a href={`mailto:${supportEmail}`}>{supportEmail}</a>} · <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`}>{BUSINESS.phone}</a>
          </p>
        </div>
        <nav aria-label="Footer">
          <AppLink href="/editor">Editor</AppLink>
          <AppLink href="/#pricing">Pricing</AppLink>
          <AppLink href="/terms">Terms & Conditions</AppLink>
          <AppLink href="/privacy">Privacy Policy</AppLink>
          <AppLink href="/refunds">Refund & Cancellation</AppLink>
          <AppLink href="/shipping">Shipping & Delivery</AppLink>
          <AppLink href="/contact">Contact Us</AppLink>
        </nav>
      </div>
    </footer>
  )
}
