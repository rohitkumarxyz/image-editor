import type { User } from '../../api/auth'
import { Button } from '../atoms/Button'
import { AccountMenu } from './AccountMenu'

interface AccountBarProps {
  user: User | null
  loading: boolean
  onSignIn: () => void
  onSignUp: () => void
  onBuy: () => void
  onHistory: () => void
  onSignOut: () => void
}

export function AccountBar({ user, loading, onSignIn, onSignUp, onBuy, onHistory, onSignOut }: AccountBarProps) {
  if (loading) return <div className="account-bar" aria-busy="true" />
  if (!user) {
    return (
      <div className="account-bar">
        <Button variant="ghost" onClick={onSignIn}>Sign in</Button>
        <Button variant="primary" onClick={onSignUp}>Sign up free</Button>
      </div>
    )
  }
  return (
    <div className="account-bar">
      <button type="button" className="credits-pill" onClick={onBuy} title="Buy more credits">
        {user.credits} credit{user.credits === 1 ? '' : 's'}
      </button>
      <AccountMenu user={user} onBuy={onBuy} onHistory={onHistory} onSignOut={onSignOut} />
    </div>
  )
}
