'use client'

import { useEffect, type ReactNode } from 'react'
import type { PublicConfig } from '../api/config'
import { AppProvider } from './AppProvider'
import { RouterProvider } from './RouterProvider'
import { useRouter } from './routerContext'
import { SessionProvider } from './SessionProvider'
import { ToastProvider } from './ToastProvider'

/** The editor keeps its dark workspace; the website pages are light. The server renders the first one. */
function ThemeSync() {
  const { path } = useRouter()
  useEffect(() => {
    document.documentElement.dataset.theme = path === '/editor' ? 'dark' : 'light'
  }, [path])
  return null
}

/** App-wide state shared by every page; lives in the root layout so it survives page changes. */
export function Providers({ children, initialConfig }: { children: ReactNode; initialConfig: PublicConfig }) {
  return (
    <RouterProvider>
      <ThemeSync />
      <SessionProvider>
        <ToastProvider>
          <AppProvider initialConfig={initialConfig}>{children}</AppProvider>
        </ToastProvider>
      </SessionProvider>
    </RouterProvider>
  )
}
