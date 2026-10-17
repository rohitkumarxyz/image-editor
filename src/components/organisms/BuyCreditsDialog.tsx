import { useState } from 'react'
import type { CreditPack } from '../../api/credits'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { Dialog } from '../molecules/Dialog'
import { Field } from '../molecules/Field'

interface BuyCreditsDialogProps {
  open: boolean
  balance: number
  packs: CreditPack[] | null
  paymentsEnabled: boolean
  savedPhone: string | null
  busyPackId: string | null
  error: string | null
  onBuy: (packId: string, phone: string) => void
  onClose: () => void
}

const looksLikePhone = (value: string) => /^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, ''))

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100)
}

export function BuyCreditsDialog({ open, balance, packs, paymentsEnabled, savedPhone, busyPackId, error, onBuy, onClose }: BuyCreditsDialogProps) {
  const [phone, setPhone] = useState(savedPhone ?? '')
  const phoneValid = looksLikePhone(phone)

  return (
    <Dialog open={open} title="Buy AI edit credits" onClose={onClose}>
      <p className="muted small">
        You have <strong>{balance}</strong> credit{balance === 1 ? '' : 's'}. One AI exact-match edit uses one credit. Normal edits, crop and downloads are free.
      </p>
      <Field label="Mobile number" hint="Needed by the payment gateway for your receipt. Saved for next time.">
        <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="98765 43210" maxLength={20} />
      </Field>
      {!packs && <p className="muted small">Loading prices…</p>}
      {packs && !paymentsEnabled && <p className="error">Payments are not set up yet. Please check back soon.</p>}
      {packs && (
        <ul className="pack-list">
          {packs.map((pack) => (
            <li key={pack.id} className="pack">
              <div className="pack__info">
                <strong>{pack.name}</strong>
                <span className="muted small">
                  {pack.credits} edits · {formatPrice(pack.amount / pack.credits, pack.currency)} each
                </span>
              </div>
              <Button
                variant="primary"
                disabled={!paymentsEnabled || !phoneValid || busyPackId !== null}
                title={phoneValid ? undefined : 'Enter your mobile number first'}
                onClick={() => onBuy(pack.id, phone)}
              >
                {busyPackId === pack.id ? 'Opening…' : formatPrice(pack.amount, pack.currency)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted small">Secure payment by Cashfree (UPI, cards, net banking). Credits never expire.</p>
    </Dialog>
  )
}
