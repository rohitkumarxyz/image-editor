import { createContext, useContext } from 'react'
import type { User } from '../api/auth'

export interface SessionValue {
  user: User | null
  /** True until the first "who am I" check finishes. */
  loading: boolean
  signIn: (input: { email: string; password: string }) => Promise<void>
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  /** Keeps the shown balance in sync after the server reports a new one. */
  setCredits: (credits: number) => void
  updateProfile: (input: { name: string }) => Promise<void>
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>
  signOutEverywhere: () => Promise<void>
  deleteAccount: (input: { password: string }) => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}
