import type { ReactNode } from 'react'
import { useTilt } from '../../../hooks/useTilt'

interface PriceCardProps {
  name: string
  price: string
  per: string
  features: string[]
  action: ReactNode
  badge?: string
  featured?: boolean
}

export function PriceCard({ name, price, per, features, action, badge, featured = false }: PriceCardProps) {
  const ref = useTilt<HTMLElement>()
  return (
    <div className="tilt-scene">
      <article ref={ref} className={`price-card tilt ${featured ? 'price-card--featured' : ''}`.trim()}>
        {badge && <span className="price-card__badge">{badge}</span>}
        <span className="price-card__name">{name}</span>
        <div>
          <div className="price-card__price">{price}</div>
          <div className="price-card__per">{per}</div>
        </div>
        <ul>
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {action}
      </article>
    </div>
  )
}
