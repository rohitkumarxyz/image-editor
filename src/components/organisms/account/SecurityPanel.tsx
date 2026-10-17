import { useState, type FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { PasswordInput } from '../../atoms/PasswordInput'
import { Field } from '../../molecules/Field'

interface SecurityPanelProps {
  onChangePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>
  onSignOutEverywhere: () => Promise<void>
}

const MIN_PASSWORD = 8

export function SecurityPanel({ onChangePassword, onSignOutEverywhere }: SecurityPanelProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = confirm.length > 0 && confirm !== next

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return
    setBusy(true)
    setError(null)
    try {
      await onChangePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" id="security">
      <h2>Password & security</h2>
      <form className="form" onSubmit={submit}>
        <Field label="Current password">
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required maxLength={128} />
        </Field>
        <div className="form-grid">
          <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} />
          </Field>
          <Field label="Repeat new password" hint={mismatch ? 'The passwords don’t match.' : undefined}>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={128} />
          </Field>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <Button variant="primary" type="submit" disabled={busy || !current || next.length < MIN_PASSWORD || next !== confirm}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </div>
        <p className="muted small">Changing your password signs you out on all other devices.</p>
      </form>
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
