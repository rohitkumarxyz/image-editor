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

  const signIn = useCallback(async (input: { email: string; password: string }) => setUser(await authApi.signIn(input)), [])
  const signUp = useCallback(async (input: { name: string; email: string; password: string }) => setUser(await authApi.signUp(input)), [])
  const signOut = useCallback(async () => {
    await authApi.signOut()
    setUser(null)
  }, [])
  const setCredits = useCallback((credits: number) => setUser((u) => (u ? { ...u, credits } : u)), [])
  const updateProfile = useCallback(async (input: { name: string }) => setUser(await authApi.updateProfile(input)), [])
  const changePassword = useCallback((input: { currentPassword: string; newPassword: string }) => authApi.changePassword(input), [])
  const signOutEverywhere = useCallback(async () => {
    await authApi.signOutEverywhere()
    setUser(null)
  }, [])
  const deleteAccount = useCallback(async (input: { password: string }) => {
    await authApi.deleteAccount(input)
    setUser(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, loading, signIn, signUp, signOut, setCredits, updateProfile, changePassword, signOutEverywhere, deleteAccount }),
    [user, loading, signIn, signUp, signOut, setCredits, updateProfile, changePassword, signOutEverywhere, deleteAccount],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
