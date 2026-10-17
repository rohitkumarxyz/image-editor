import { Button } from '../../atoms/Button'

interface SecurityPanelProps {
  onSignOutEverywhere: () => Promise<void>
}

export function SecurityPanel({ onSignOutEverywhere }: SecurityPanelProps) {
  return (
    <section className="panel" id="security">
      <h2>Security</h2>
      <p className="muted small">You sign in with Google. Manage your password and two-step verification in your Google account.</p>
      <div className="panel__row">
        <div>
          <strong>Sign out everywhere</strong>
          <p className="muted small">Ends every session, including this one. Use it if you signed in on a shared computer.</p>
        </div>
        <Button onClick={onSignOutEverywhere}>Sign out of all devices</Button>
      </div>
    </section>
  )
}
