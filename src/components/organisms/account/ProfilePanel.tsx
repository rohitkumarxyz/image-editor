import { useState, type FormEvent } from 'react'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { Field } from '../../molecules/Field'

interface ProfilePanelProps {
  name: string
  email: string
  onSave: (name: string) => Promise<void>
}

export function ProfilePanel({ name, email, onSave }: ProfilePanelProps) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(value.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" id="profile">
      <h2>Profile</h2>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <Input value={value} onChange={(e) => setValue(e.target.value)} required maxLength={80} autoComplete="name" />
          </Field>
          <Field label="Email" hint="Your sign-in email can't be changed yet.">
            <Input value={email} readOnly disabled />
          </Field>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <Button variant="primary" type="submit" disabled={busy || !value.trim() || value.trim() === name}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </section>
  )
}
