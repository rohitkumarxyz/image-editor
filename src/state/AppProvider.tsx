'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configApi, type PublicConfig } from '../api/config'
import { ToastStack } from '../components/organisms/ToastStack'
import { AccountDialogs, type AccountDialog } from '../views/AccountDialogs'
import { AppContext } from './appContext'
import { useRouter } from './routerContext'
import { useSession } from './sessionContext'
import { useToast } from './toastContext'

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
      if ((next === 'signin' || next === 'signup') && path !== '/editor') {
        navigate(`/${next}?next=${encodeURIComponent(path === '/signin' || path === '/signup' ? '/' : path)}`)
        return
      }
      setDialog(next)
    },
    [path, navigate],
  )

  useEffect(() => {
    if (!user && path !== '/signin' && path !== '/signup') afterSignIn.current = null
  }, [path, user])
  const closeDialog = useCallback((reason: 'done' | 'dismissed') => {
    setDialog(null)
    if (reason === 'dismissed') afterSignIn.current = null
  }, [])

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
