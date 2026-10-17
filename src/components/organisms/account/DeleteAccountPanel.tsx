import { useState, type FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { Checkbox } from '../../atoms/Checkbox'
import { PasswordInput } from '../../atoms/PasswordInput'
import { Field } from '../../molecules/Field'

interface DeleteAccountPanelProps {
  credits: number
  onDelete: (password: string) => Promise<void>
}

export function DeleteAccountPanel({ credits, onDelete }: DeleteAccountPanelProps) {
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onDelete(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account.')
      setBusy(false)
    }
  }

  return (
    <section className="panel panel--danger" id="delete">
      <h2>Delete account</h2>
      <p className="muted small">
        This permanently deletes your account{credits > 0 ? ` and your ${credits} remaining credit${credits === 1 ? '' : 's'}` : ''}. It can't be undone.
      </p>
      <form className="form" onSubmit={submit}>
        <Field label="Enter your password to confirm">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={128} />
        </Field>
        <Checkbox checked={understood} label="I understand this can't be undone" onChange={setUnderstood} />
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <Button variant="danger" type="submit" disabled={busy || !password || !understood}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>
    </section>
  )
}
