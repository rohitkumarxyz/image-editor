import { createContext, useContext } from 'react'

export interface RouterValue {
  path: string
  /** Client-side navigation; `#section` targets scroll into view. */
  navigate: (to: string) => void
  /**
   * Lets a page block leaving (e.g. unsaved edits). The guard returns true to allow leaving; pass null to remove it.
   */
  setLeaveGuard: (guard: (() => boolean) | null) => void
}

export const RouterContext = createContext<RouterValue | null>(null)

export function useRouter(): RouterValue {
  const value = useContext(RouterContext)
  if (!value) throw new Error('useRouter must be used inside <RouterProvider>')
  return value
}
