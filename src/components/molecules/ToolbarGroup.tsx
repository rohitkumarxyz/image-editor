import type { ReactNode } from 'react'

export function ToolbarGroup({ label, className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`toolbar-group ${className}`.trim()}>
      {label && <span className="toolbar-group__label">{label}</span>}
      {children}
    </div>
  )
}
