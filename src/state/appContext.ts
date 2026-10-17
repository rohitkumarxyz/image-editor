import { createContext, useContext } from 'react'
import type { PublicConfig } from '../api/config'
import type { AccountDialog } from '../views/AccountDialogs'

export interface AppValue {
  config: PublicConfig
  openAccount: (dialog: AccountDialog, then?: () => void) => void
  setPendingFile: (file: File) => void
  takePendingFile: () => File | null
}

export const AppContext = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <AppProvider>')
  return value
}
