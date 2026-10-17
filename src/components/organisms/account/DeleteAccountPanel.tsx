import { useState, type FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { Checkbox } from '../../atoms/Checkbox'

interface DeleteAccountPanelProps {
  credits: number
  onDelete: () => Promise<void>
}

export function DeleteAccountPanel({ credits, onDelete }: DeleteAccountPanelProps) {
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onDelete()
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
        <Checkbox checked={understood} label="I understand this can't be undone" onChange={setUnderstood} />
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <Button variant="danger" type="submit" disabled={busy || !understood}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>
    </section>
  )
}
