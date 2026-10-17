import { useState } from 'react'
import type { LedgerEntry } from '../../../api/credits'
import { Button } from '../../atoms/Button'
import { LedgerTable } from '../../molecules/LedgerTable'

interface CreditsPanelProps {
  credits: number
  history: LedgerEntry[] | null
  historyError: string | null
  onBuy: () => void
}

const PREVIEW_ROWS = 10

export function CreditsPanel({ credits, history, historyError, onBuy }: CreditsPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const rows = history && !showAll ? history.slice(0, PREVIEW_ROWS) : history
  return (
    <section className="panel" id="credits">
      <div className="panel__row">
        <div>
          <h2>Credits</h2>
          <p className="muted small">One credit = one AI exact-match edit. Credits never expire.</p>
        </div>
        <div className="panel__row">
          <span className="balance">
            <strong>{credits}</strong> <span className="muted">credit{credits === 1 ? '' : 's'} left</span>
          </span>
          <Button variant="primary" className="btn--lg" onClick={onBuy}>Buy credits</Button>
        </div>
      </div>
      {!history && !historyError && <p className="muted small">Loading history…</p>}
      {historyError && <p className="error">{historyError}</p>}
      {rows && <LedgerTable entries={rows} />}
      {history && history.length > PREVIEW_ROWS && (
        <div>
          <Button variant="ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show less' : `Show all ${history.length} entries`}
          </Button>
        </div>
      )}
    </section>
  )
}
