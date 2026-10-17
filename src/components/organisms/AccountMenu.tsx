import { useEffect, useRef, useState } from 'react'
import type { User } from '../../api/auth'
import { AppLink } from '../atoms/AppLink'
import { Icon } from '../atoms/Icon'

interface AccountMenuProps {
  user: User
  onBuy: () => void
  onHistory: () => void
  onSignOut: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export function AccountMenu({ user, onBuy, onHistory, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={() => setOpen((o) => !o)}>
        {initials(user.name)}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__head">
            <strong>{user.name}</strong>
            <span className="muted small">{user.email}</span>
          </div>
          <AppLink href="/account" className="menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" /> Account settings
          </AppLink>
          <button type="button" className="menu__item" role="menuitem" onClick={run(onBuy)}>
            <Icon name="coins" /> Buy credits <span className="muted small" style={{ marginLeft: 'auto' }}>{user.credits} left</span>
          </button>
          <button type="button" className="menu__item" role="menuitem" onClick={run(onHistory)}>
            <Icon name="history" /> Credit history
          </button>
          <AppLink href="/editor" className="menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="pencil" /> Open editor
          </AppLink>
          <button type="button" className="menu__item" role="menuitem" onClick={run(onSignOut)}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
