'use client'

import { usePathname, useRouter as useNextRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { RouterContext } from './routerContext'

function scrollToHash(hash: string) {
  if (!hash) {
    window.scrollTo({ top: 0 })
    return
  }
  requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useNextRouter()
  const guard = useRef<(() => boolean) | null>(null)
  const pendingHash = useRef<string | null>(null)
  const setLeaveGuard = useCallback((next: (() => boolean) | null) => {
    guard.current = next
  }, [])

  const shownPath = useRef(path)
  const shownState = useRef<unknown>(null)
  useEffect(() => {
    shownPath.current = path
    shownState.current = window.history.state
  }, [path])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const from = shownPath.current
      if (guard.current && window.location.pathname !== from && !guard.current()) {
        event.stopImmediatePropagation()
        window.history.pushState(shownState.current, '', from)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash)
  }, [])

  useEffect(() => {
    if (pendingHash.current === null) return
    scrollToHash(pendingHash.current)
    pendingHash.current = null
  }, [path])

  const navigate = useCallback(
    (to: string) => {
      const url = new URL(to, window.location.origin)
      if (url.pathname !== window.location.pathname && guard.current && !guard.current()) return
      if (url.pathname !== window.location.pathname) {
        pendingHash.current = url.hash
        router.push(url.pathname + url.hash, { scroll: false })
        return
      }
      if (url.hash !== window.location.hash) window.history.pushState(null, '', url.pathname + url.hash)
      scrollToHash(url.hash)
    },
    [router],
  )

  const value = useMemo(() => ({ path, navigate, setLeaveGuard }), [path, navigate, setLeaveGuard])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
