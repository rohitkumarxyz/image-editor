import type { LedgerEntry } from '../../api/credits'
import { Dialog } from '../molecules/Dialog'
import { LedgerTable } from '../molecules/LedgerTable'

interface HistoryDialogProps {
  open: boolean
  entries: LedgerEntry[] | null
  error: string | null
  onClose: () => void
}

export function HistoryDialog({ open, entries, error, onClose }: HistoryDialogProps) {
  return (
    <Dialog open={open} title="Credit history" onClose={onClose}>
      {!entries && !error && <p className="muted small">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {entries && <LedgerTable entries={entries} />}
    </Dialog>
  )
}
