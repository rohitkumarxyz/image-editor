'use client'

import { useEffect, type ReactNode } from 'react'
import type { PublicConfig } from '../api/config'
import { AppProvider } from './AppProvider'
import { RouterProvider } from './RouterProvider'
import { useRouter } from './routerContext'
import { SessionProvider } from './SessionProvider'
import { ToastProvider } from './ToastProvider'

function ThemeSync() {
  const { path } = useRouter()
  useEffect(() => {
    document.documentElement.dataset.theme = path === '/editor' ? 'dark' : 'light'
  }, [path])
  return null
}

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
