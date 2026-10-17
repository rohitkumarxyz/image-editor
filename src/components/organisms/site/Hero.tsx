import { useRef, useState, type DragEvent } from 'react'
import type { Example } from '../../../lib/examples'
import { Button } from '../../atoms/Button'
import { Icon } from '../../atoms/Icon'

interface HeroProps {
  freeCredits: number
  examples: Example[]
  error: string | null
  onFile: (file: File) => void
  onExample: (example: Example) => void
}

/** The tool is the hero: drop an image (or pick an example) and the editor opens with it. */
export function Hero({ freeCredits, examples, error, onFile, onExample }: HeroProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <section className="hero">
      <div className="page">
        <div className="hero__copy">
          <h1 className="hero__title">
            Change text in any image. <em>Keep the same font.</em>
          </h1>
          <p className="lead">Fix a price, a date or a word on a poster, menu or banner. The new text matches the original lettering, so it looks untouched.</p>
        </div>

        <div
          className={`upload-box ${dragging ? 'upload-box--active' : ''}`.trim()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <span className="upload-box__icon"><Icon name="upload" className="icon--lg" /></span>
          <Button variant="primary" className="btn--lg" onClick={() => inputRef.current?.click()}>
            Upload image
          </Button>
          <span className="muted small">or drop a file here, or paste with Ctrl/⌘+V · PNG, JPG or WEBP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ''
            }}
          />
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="examples-strip">
          <span>No image? Try one:</span>
          {examples.map((ex) => (
            <button key={ex.id} type="button" className="thumb" title={`Try the ${ex.label.toLowerCase()} example`} onClick={() => onExample(ex)}>
              <img src={ex.before} alt={ex.label} />
            </button>
          ))}
        </div>

        <ul className="trust">
          <li><Icon name="check" /> Free to try, no sign-up</li>
          {freeCredits > 0 && <li><Icon name="check" /> {freeCredits} free AI edits when you join</li>}
          <li><Icon name="check" /> Hindi + English</li>
          <li><Icon name="check" /> Your images are never stored</li>
        </ul>
      </div>
    </section>
  )
}
