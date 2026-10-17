import { useState } from 'react'
import { useReveal } from '../../../hooks/useReveal'
import type { Example } from '../../../lib/examples'
import { CompareSlider } from '../../molecules/site/CompareSlider'
import { SectionHeading } from '../../molecules/site/SectionHeading'

export function ExamplesSection({ examples }: { examples: Example[] }) {
  const ref = useReveal<HTMLElement>()
  const [activeId, setActiveId] = useState(examples[0].id)
  const active = examples.find((e) => e.id === activeId) ?? examples[0]

  return (
    <section ref={ref} className="section section--alt reveal" id="examples">
      <div className="page">
        <SectionHeading center eyebrow="Real results" title="Can you spot the edit?" lead="Every example below was edited with this app. Drag the slider to compare." />
        <div className="example-tabs" role="tablist" aria-label="Examples">
          {examples.map((ex) => (
            <button
              key={ex.id}
              type="button"
              role="tab"
              aria-selected={ex.id === active.id}
              className={`thumb example-tab ${ex.id === active.id ? 'thumb--active' : ''}`.trim()}
              onClick={() => setActiveId(ex.id)}
            >
              <img src={ex.after} alt="" />
              {ex.label}
            </button>
          ))}
        </div>
        <div className="example-stage">
          <CompareSlider key={active.id} before={active.before} after={active.after} alt={active.alt} />
          <p className="example-caption">
            <strong>Changed:</strong> {active.change}
          </p>
        </div>
      </div>
    </section>
  )
}
