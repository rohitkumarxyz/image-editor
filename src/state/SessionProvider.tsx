'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type User } from '../api/auth'
import { SessionContext, type SessionValue } from './sessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signInWithGoogle = useCallback(async (credential: string) => {
    const { user, isNew } = await authApi.signInWithGoogle(credential)
    setUser(user)
    return isNew
  }, [])
  const signOut = useCallback(async () => {
    await authApi.signOut()
    setUser(null)
  }, [])
  const setCredits = useCallback((credits: number) => setUser((u) => (u ? { ...u, credits } : u)), [])
  const updateProfile = useCallback(async (input: { name: string }) => setUser(await authApi.updateProfile(input)), [])
  const signOutEverywhere = useCallback(async () => {
    await authApi.signOutEverywhere()
    setUser(null)
  }, [])
  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount()
    setUser(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, loading, signInWithGoogle, signOut, setCredits, updateProfile, signOutEverywhere, deleteAccount }),
    [user, loading, signInWithGoogle, signOut, setCredits, updateProfile, signOutEverywhere, deleteAccount],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
