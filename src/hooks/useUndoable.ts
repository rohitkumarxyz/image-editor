import { useCallback, useRef, useState } from 'react'

const MAX_STEPS = 100
/** Changes with the same key within this time become one undo step (e.g. typing a word). */
const COALESCE_MS = 1000

interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export interface Undoable<T> {
  value: T
  /** `coalesceKey` merges quick repeated changes to the same thing into one undo step. */
  set: (update: (prev: T) => T, coalesceKey?: string) => void
  undo: () => void
  redo: () => void
  /** Replaces the value and forgets history (e.g. a new image). */
  reset: (value: T) => void
  canUndo: boolean
  canRedo: boolean
}

export function useUndoable<T>(initial: T): Undoable<T> {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] })
  const last = useRef<{ key: string | undefined; at: number }>({ key: undefined, at: 0 })

  const set = useCallback((update: (prev: T) => T, coalesceKey?: string) => {
    const now = Date.now()
    const merge = coalesceKey !== undefined && last.current.key === coalesceKey && now - last.current.at < COALESCE_MS
    last.current = { key: coalesceKey, at: now }
    setHistory((h) => {
      const next = update(h.present)
      if (Object.is(next, h.present)) return h
      return merge ? { ...h, present: next } : { past: [...h.past, h.present].slice(-MAX_STEPS), present: next, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    last.current = { key: undefined, at: 0 }
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h))
  }, [])

  const redo = useCallback(() => {
    last.current = { key: undefined, at: 0 }
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h))
  }, [])

  const reset = useCallback((value: T) => {
    last.current = { key: undefined, at: 0 }
    setHistory({ past: [], present: value, future: [] })
  }, [])

  return { value: history.present, set, undo, redo, reset, canUndo: history.past.length > 0, canRedo: history.future.length > 0 }
}
