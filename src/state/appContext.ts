import { createContext, useContext } from 'react'
import type { PublicConfig } from '../api/config'
import type { AccountDialog } from '../views/AccountDialogs'

export interface AppValue {
  config: PublicConfig
  /** `then` runs once the user is signed in (e.g. continue the AI edit they clicked); closing the dialog cancels it. */
  openAccount: (dialog: AccountDialog, then?: () => void) => void
  /** A file picked on another page (e.g. the home page upload box) for the editor to open. */
  setPendingFile: (file: File) => void
  takePendingFile: () => File | null
}

export const DEFAULT_CONFIG: PublicConfig = {
  aiEditCost: 1,
  signupCredits: 3,
  paymentsEnabled: false,
  businessName: 'Image Text Editor',
  supportEmail: '',
  googleClientId: '',
}

export const AppContext = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <AppProvider>')
  return value
}
