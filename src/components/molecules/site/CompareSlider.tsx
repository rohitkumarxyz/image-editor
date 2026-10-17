import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Icon } from '../../atoms/Icon'

interface CompareSliderProps {
  before: string
  after: string
  alt: string
}

const KEY_STEP = 5

export function CompareSlider({ before, after, alt }: CompareSliderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState(50)
  const [dragging, setDragging] = useState(false)

  const moveTo = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    setSplit(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    moveTo(e.clientX)
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - KEY_STEP))
    if (e.key === 'ArrowRight') setSplit((s) => Math.min(100, s + KEY_STEP))
  }

  return (
    <div
      ref={ref}
      className="compare"
      role="slider"
      tabIndex={0}
      aria-label="Compare original and edited image"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(split)}
      onPointerDown={down}
      onPointerMove={(e) => dragging && moveTo(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onKeyDown={key}
    >
      <img src={before} alt={`${alt} (original)`} draggable={false} />
      <div className="compare__after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        <img src={after} alt={`${alt} (edited)`} draggable={false} />
      </div>
      <div className="compare__handle" style={{ left: `calc(${split}% - 1px)` }}>
        <span className="compare__knob" aria-hidden="true"><Icon name="arrows" /></span>
      </div>
      <span className="compare__label compare__label--before">Original</span>
      <span className="compare__label compare__label--after">Edited</span>
    </div>
  )
}
