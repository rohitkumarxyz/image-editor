import { useRef, useState } from 'react'
import type { Example } from '../../lib/examples'
import { Button } from '../atoms/Button'

interface UploadDropzoneProps {
  onFile: (file: File) => void
  error?: string | null
  examples: Example[]
  onExample: (example: Example) => void
}

export function UploadDropzone({ onFile, error, examples, onExample }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pick(e.dataTransfer.files)
      }}
    >
      <h1>Open an image to edit</h1>
      <p className="muted">Drop it here, paste it with Ctrl/⌘+V, or choose a file. Text is found automatically.</p>
      <Button variant="primary" className="btn--lg" onClick={() => inputRef.current?.click()}>
        Choose image
      </Button>
      <div className="examples-strip">
        <span>Or try one:</span>
        {examples.map((ex) => (
          <button key={ex.id} type="button" className="thumb" title={`Try the ${ex.label.toLowerCase()} example`} onClick={() => onExample(ex)}>
            <img src={ex.before} alt={ex.label} />
          </button>
        ))}
      </div>
      <p className="muted small">PNG, JPG or WEBP. Editing runs in your browser and nothing is stored. AI features send a copy to our AI provider to create the result.</p>
      {error && <p className="error">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
    </div>
  )
}
