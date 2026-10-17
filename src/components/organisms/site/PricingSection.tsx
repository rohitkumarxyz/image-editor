import type { CreditPack } from '../../../api/credits'
import { useReveal } from '../../../hooks/useReveal'
import { AppLink } from '../../atoms/AppLink'
import { Button } from '../../atoms/Button'
import { PriceCard } from '../../molecules/site/PriceCard'
import { SectionHeading } from '../../molecules/site/SectionHeading'

interface PricingSectionProps {
  packs: CreditPack[] | null
  freeCredits: number
  featuredPackId: string
  onBuy: (packId: string) => void
}

function money(amount: number, currency: string, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(amount / 100)
}

export function PricingSection({ packs, freeCredits, featuredPackId, onBuy }: PricingSectionProps) {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} className="section reveal" id="pricing">
      <div className="page">
        <SectionHeading
          center
          eyebrow="Pricing"
          title="Pay only for AI edits"
          lead="Detecting, editing, cropping and downloading are free. Buy credits when you want a pixel-perfect AI result: one credit per edit."
        />
        <div className="pricing-grid">
          <PriceCard
            name="Free"
            price={money(0, 'INR')}
            per="forever"
            features={[
              'Text detection (Hindi + English)',
              'Font-matched edits',
              'Crop in any shape',
              'PNG & PDF download',
              ...(freeCredits > 0 ? [`${freeCredits} AI edits when you sign up`] : []),
            ]}
            action={<AppLink href="/editor" variant="secondary" className="btn--lg">Start editing</AppLink>}
          />
          {(packs ?? []).map((pack) => (
            <PriceCard
              key={pack.id}
              name={pack.name}
              price={money(pack.amount, pack.currency)}
              per={`${pack.credits} AI edits · ${money(pack.amount / pack.credits, pack.currency, 1)} per edit`}
              features={['Pixel-perfect AI exact match', 'AI text finder for brush & script text', 'Credit back if a result fails our checks', 'Credits never expire']}
              featured={pack.id === featuredPackId}
              badge={pack.id === featuredPackId ? 'Most popular' : undefined}
              action={
                <Button variant={pack.id === featuredPackId ? 'primary' : 'secondary'} className="btn--lg" onClick={() => onBuy(pack.id)}>
                  Buy {pack.name}
                </Button>
              }
            />
          ))}
        </div>
        <p className="price-note">Prices in INR. Secure payment by Cashfree: UPI, cards, net banking and wallets.</p>
      </div>
    </section>
  )
}
