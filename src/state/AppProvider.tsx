'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configApi, type PublicConfig } from '../api/config'
import { ToastStack } from '../components/organisms/ToastStack'
import { AccountDialogs, type AccountDialog } from '../views/AccountDialogs'
import { AppContext } from './appContext'
import { useRouter } from './routerContext'
import { useSession } from './sessionContext'
import { useToast } from './toastContext'

/** App-wide settings from the server plus the account dialogs and toasts, shared by every page. */
export function AppProvider({ children, initialConfig }: { children: ReactNode; initialConfig: PublicConfig }) {
  const [config, setConfig] = useState<PublicConfig>(initialConfig)
  const [dialog, setDialog] = useState<AccountDialog | null>(null)
  const toast = useToast()
  const { user } = useSession()
  const afterSignIn = useRef<(() => void) | null>(null)
  const { path, navigate } = useRouter()

  const openAccount = useCallback(
    (next: AccountDialog, then?: () => void) => {
      if (then) afterSignIn.current = then
      // The editor keeps the popup: leaving the page would lose the open image and its edits.
      if ((next === 'signin' || next === 'signup') && path !== '/editor') {
        navigate(`/${next}?next=${encodeURIComponent(path === '/signin' || path === '/signup' ? '/' : path)}`)
        return
      }
      setDialog(next)
    },
    [path, navigate],
  )

  // Leaving the sign-in pages without signing in cancels the waiting action.
  useEffect(() => {
    if (!user && path !== '/signin' && path !== '/signup') afterSignIn.current = null
  }, [path, user])
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
      <AccountDialogs dialog={dialog} freeCredits={config.signupCredits} googleClientId={config.googleClientId} onOpen={setDialog} onClose={closeDialog} />
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </AppContext.Provider>
  )
}
