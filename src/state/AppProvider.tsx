'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configApi, type PublicConfig } from '../api/config'
import { ToastStack } from '../components/organisms/ToastStack'
import { AccountDialogs, type AccountDialog } from '../views/AccountDialogs'
import { AppContext, DEFAULT_CONFIG } from './appContext'
import { useSession } from './sessionContext'
import { useToast } from './toastContext'

/** App-wide settings from the server plus the account dialogs and toasts, shared by every page. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG)
  const [dialog, setDialog] = useState<AccountDialog | null>(null)
  const toast = useToast()
  const { user } = useSession()
  const afterSignIn = useRef<(() => void) | null>(null)

  const openAccount = useCallback((next: AccountDialog, then?: () => void) => {
    if (then) afterSignIn.current = then
    setDialog(next)
  }, [])
  const closeDialog = useCallback((reason: 'done' | 'dismissed') => {
    setDialog(null)
    // A dismissed dialog cancels the waiting action; after a successful sign-in it runs (effect below).
    if (reason === 'dismissed') afterSignIn.current = null
  }, [])

  // Runs after the page has re-rendered with the signed-in user, so it sees fresh state.
  useEffect(() => {
    if (!user || !afterSignIn.current) return
    const action = afterSignIn.current
    afterSignIn.current = null
    action()
  }, [user])

  useEffect(() => {
    configApi.get().then(setConfig).catch(() => undefined)
  }, [])

  const pendingFile = useRef<File | null>(null)
  const setPendingFile = useCallback((file: File) => {
    pendingFile.current = file
  }, [])
  const takePendingFile = useCallback(() => {
    const file = pendingFile.current
    pendingFile.current = null
    return file
  }, [])

  const value = useMemo(() => ({ config, openAccount, setPendingFile, takePendingFile }), [config, openAccount, setPendingFile, takePendingFile])
  return (
    <AppContext.Provider value={value}>
      {children}
      <AccountDialogs dialog={dialog} freeCredits={config.signupCredits} supportEmail={config.supportEmail} onOpen={setDialog} onClose={closeDialog} />
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </AppContext.Provider>
  )
}
