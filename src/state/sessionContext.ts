import { createContext, useContext } from 'react'
import type { User } from '../api/auth'

export interface SessionValue {
  user: User | null
  loading: boolean
  signInWithGoogle: (credential: string) => Promise<boolean>
  signOut: () => Promise<void>
  setCredits: (credits: number) => void
  updateProfile: (input: { name: string }) => Promise<void>
  signOutEverywhere: () => Promise<void>
  deleteAccount: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}
