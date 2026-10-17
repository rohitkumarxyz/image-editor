'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastKind, type ToastValue } from './toastContext'

const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 }
const MAX_TOASTS = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, kind, message }].slice(-MAX_TOASTS))
      window.setTimeout(() => dismiss(id), DURATION_MS[kind])
    },
    [dismiss],
  )

  const value = useMemo<ToastValue>(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}
