import { useEffect, useRef } from 'react'

const MAX_DEG = 8

export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover)').matches) return
    const move = (e: PointerEvent) => {
      const r = node.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      node.style.transform = `rotateX(${-y * MAX_DEG}deg) rotateY(${x * MAX_DEG}deg) translateZ(8px)`
    }
    const leave = () => {
      node.style.transform = ''
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerleave', leave)
    return () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerleave', leave)
    }
  }, [])
  return ref
}
