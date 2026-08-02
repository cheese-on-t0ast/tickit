import { useCallback, useRef, useState, type PointerEvent } from 'react'

interface UseSwipeOptions {
  onSwipeRight: () => void
  onSwipeLeft: () => void
}

/** Row swipe gesture matching the mockup's exact thresholds: clamp to
 * +/-118px, reveal the underlying action past +/-12px, trigger past +/-70px. */
export function useSwipe({ onSwipeRight, onSwipeLeft }: UseSwipeOptions) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const draggedRef = useRef(false)
  const lastDx = useRef(0)

  const onPointerDown = useCallback((e: PointerEvent) => {
    startX.current = e.clientX
    draggedRef.current = false
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (startX.current === null) return
    const raw = e.clientX - startX.current
    if (Math.abs(raw) > 3) draggedRef.current = true
    const clamped = Math.max(-118, Math.min(118, raw))
    lastDx.current = clamped
    setDx(clamped)
  }, [])

  const onPointerUp = useCallback(() => {
    const d = lastDx.current
    if (d >= 70) onSwipeRight()
    else if (d <= -70) onSwipeLeft()
    startX.current = null
    setDx(0)
    setDragging(false)
  }, [onSwipeRight, onSwipeLeft])

  /** True if the gesture that just ended moved enough to count as a swipe,
   * not a tap — callers should suppress a row's "open detail" click. */
  const wasSwipe = useCallback(() => Math.abs(lastDx.current) > 6, [])

  return {
    dx,
    dragging,
    wasSwipe,
    showBump: dx > 12,
    showDelete: dx < -12,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
