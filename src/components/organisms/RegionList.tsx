import { useState } from 'react'
import type { OcrLevel, TextRegion } from '../../types'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { Select, type SelectOption } from '../atoms/Select'
import { PanelSection } from '../molecules/PanelSection'

const LEVELS: SelectOption<OcrLevel>[] = [
  { value: 'line', label: 'One box per line' },
  { value: 'word', label: 'One box per word' },
]

interface RegionListProps {
  regions: TextRegion[]
  selectedId: string | null
  level: OcrLevel
  onSelect: (id: string) => void
  onLevelChange: (level: OcrLevel) => void
  onClearAll: () => void
}

export function RegionList({ regions, selectedId, level, onSelect, onLevelChange, onClearAll }: RegionListProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = q ? regions.filter((r) => `${r.text} ${r.originalText}`.toLowerCase().includes(q)) : regions

  return (
    <PanelSection
      title={`Detected text (${regions.length})`}
      actions={regions.length > 0 ? <Button variant="ghost" onClick={onClearAll}>Remove all</Button> : undefined}
    >
      <Select value={level} options={LEVELS} onChange={onLevelChange} aria-label="How to split detected text" />
      {regions.length > 3 && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search text…" aria-label="Search detected text" />}
      {regions.length === 0 ? (
        <p className="muted small">No boxes yet. Click “Detect text”, or use “+ Mark text” and drag over any text that wasn’t found.</p>
      ) : (
        <ul className="region-list">
          {visible.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`region-list__item ${r.id === selectedId ? 'region-list__item--selected' : ''}`}
                onClick={() => onSelect(r.id)}
              >
                <span className="region-list__text">{r.text || <em className="muted">(empty)</em>}</span>
                {r.edited && <span className="badge badge--edited">edited</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  )
}
