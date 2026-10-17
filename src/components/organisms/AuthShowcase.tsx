import type { Example } from '../../lib/examples'
import { useTilt } from '../../hooks/useTilt'

interface AuthShowcaseProps {
  hero: Example
  stack: Example[]
}

export function AuthShowcase({ hero, stack }: AuthShowcaseProps) {
  const tilt = useTilt<HTMLDivElement>()
  return (
    <div className="showcase" aria-hidden="true">
      <div ref={tilt} className="showcase__scene">
        {stack.map((example, i) => (
          <img key={example.id} className={`showcase__card showcase__card--${i + 1}`} src={example.after} alt="" />
        ))}
        <div className="showcase__flip">
          <div className="showcase__face showcase__face--front">
            <img src={hero.before} alt="" />
            <span className="showcase__label">Original</span>
          </div>
          <div className="showcase__face showcase__face--back">
            <img src={hero.after} alt="" />
            <span className="showcase__label showcase__label--edited">Edited</span>
          </div>
        </div>
      </div>
      <p className="showcase__caption">{hero.change}</p>
    </div>
  )
}
