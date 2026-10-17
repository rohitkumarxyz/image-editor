import type { LedgerEntry, LedgerReason } from '../../api/credits'

const REASONS: Record<LedgerReason, string> = {
  signup_bonus: 'Welcome credits',
  purchase: 'Credits bought',
  ai_edit: 'AI exact-match edit',
  ai_edit_refund: 'Credit returned',
}

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return <p className="muted small">No activity yet.</p>
  return (
    <table className="history">
      <thead>
        <tr>
          <th>When</th>
          <th>What</th>
          <th className="num">Change</th>
          <th className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.createdAt).toLocaleString()}</td>
            <td>{REASONS[e.reason]}</td>
            <td className={`num ${e.delta > 0 ? 'history__plus' : ''}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
            <td className="num">{e.balanceAfter}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
