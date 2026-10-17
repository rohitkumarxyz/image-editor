import type { ReactNode } from 'react'

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  center?: boolean
}

export function SectionHeading({ eyebrow, title, lead, center = false }: SectionHeadingProps) {
  return (
    <div className={`section-heading ${center ? 'section-heading--center' : ''}`.trim()}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="section-title">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  )
}
