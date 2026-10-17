import { useReveal } from '../../../hooks/useReveal'
import type { IconName } from '../../atoms/Icon'
import { FeatureCard } from '../../molecules/site/FeatureCard'
import { SectionHeading } from '../../molecules/site/SectionHeading'

export interface CardItem {
  icon: IconName
  title: string
  text: string
}

interface CardSectionProps {
  id: string
  eyebrow: string
  title: string
  lead?: string
  items: CardItem[]
  alt?: boolean
}

export function CardSection({ id, eyebrow, title, lead, items, alt = false }: CardSectionProps) {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} className={`section reveal ${alt ? 'section--alt' : ''}`.trim()} id={id}>
      <div className="page">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="card-grid">
          {items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}
