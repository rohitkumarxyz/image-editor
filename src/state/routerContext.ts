import { createContext, useContext } from 'react'

export interface RouterValue {
  path: string
  navigate: (to: string) => void
  setLeaveGuard: (guard: (() => boolean) | null) => void
}

export const RouterContext = createContext<RouterValue | null>(null)

export function useRouter(): RouterValue {
  const value = useContext(RouterContext)
  if (!value) throw new Error('useRouter must be used inside <RouterProvider>')
  return value
}
