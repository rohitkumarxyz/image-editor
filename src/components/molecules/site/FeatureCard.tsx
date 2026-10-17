import { useTilt } from '../../../hooks/useTilt'
import { Icon, type IconName } from '../../atoms/Icon'

interface FeatureCardProps {
  icon: IconName
  title: string
  text: string
}

export function FeatureCard({ icon, title, text }: FeatureCardProps) {
  const ref = useTilt<HTMLElement>()
  return (
    <div className="tilt-scene">
      <article ref={ref} className="feature-card tilt">
        <span className="feature-card__icon"><Icon name={icon} /></span>
        <h3>{title}</h3>
        <p>{text}</p>
      </article>
    </div>
  )
}
