'use client'

import { usePathname, useRouter as useNextRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { RouterContext } from './routerContext'

function scrollToHash(hash: string) {
  if (!hash) {
    window.scrollTo({ top: 0 })
    return
  }
  // Wait a frame so the target page has rendered.
  requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** The app's router on top of Next.js navigation: same `navigate` / leave-guard API the pages already use. */
export function RouterProvider({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useNextRouter()
  const guard = useRef<(() => boolean) | null>(null)
  /** Hash to scroll to once the next page has rendered. */
  const pendingHash = useRef<string | null>(null)
  const setLeaveGuard = useCallback((next: (() => boolean) | null) => {
    guard.current = next
  }, [])

  /** The page on screen and its history entry; refs so the popstate listener below never has to be re-added. */
  const shownPath = useRef(path)
  const shownState = useRef<unknown>(null)
  useEffect(() => {
    shownPath.current = path
    // Next.js has written its own state for this page by now (it does so before effects run).
    shownState.current = window.history.state
  }, [path])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      // Back/forward can't be cancelled, so step forward again if the page refuses to leave. Window listeners run
      // in the order they were added: this one is added once, before Next.js's own (child effects run first), so
      // it can stop the event before Next.js swaps the page and the editor unmounts with its unsaved work.
      const from = shownPath.current
      if (guard.current && window.location.pathname !== from && !guard.current()) {
        event.stopImmediatePropagation()
        // Re-adding the page's own Next.js state keeps Next.js from rebuilding the page (and losing its work).
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
