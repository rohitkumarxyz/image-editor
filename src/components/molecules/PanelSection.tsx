import type { ReactNode } from 'react'

interface PanelSectionProps {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export function PanelSection({ title, actions, children }: PanelSectionProps) {
  return (
    <section className="panel-section">
      <header className="panel-section__header">
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="panel-section__body">{children}</div>
    </section>
  )
}
