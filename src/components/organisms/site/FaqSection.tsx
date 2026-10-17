import { useReveal } from '../../../hooks/useReveal'
import { FaqItem } from '../../molecules/site/FaqItem'
import { SectionHeading } from '../../molecules/site/SectionHeading'

export function FaqSection({ items }: { items: { question: string; answer: string }[] }) {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} className="section reveal" id="faq">
      <div className="page">
        <SectionHeading center eyebrow="FAQ" title="Questions, answered" />
        <div className="faq">
          {items.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}
