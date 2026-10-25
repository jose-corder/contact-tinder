import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { useCopyFeedback } from './useCopyFeedback'

export interface LongPressCopyOptions { onCopied?: () => void }
/** Spread handlers on the target and render feedback beside it; copy() supports an explicit retry. */
export function useLongPressCopy(value: string, { onCopied }: LongPressCopyOptions = {}) {
  const { busy, result, copy, status, fallback } = useCopyFeedback(value, onCopied)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const consumed = useRef(false)
  const cancel = () => { clearTimeout(timer.current); origin.current = null }
  useLayoutEffect(() => {
    consumed.current = false
    return cancel
  }, [value])
  const handlers: HTMLAttributes<HTMLElement> = {
    onPointerDown: event => {
      cancel(); consumed.current = false
      if (event.button !== 0 || busy) return
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => { consumed.current = true; origin.current = null; void copy() }, 500)
    },
    onPointerMove: event => {
      if (origin.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel()
    },
    onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel, onBlur: cancel,
    onContextMenu: event => { if (origin.current || consumed.current) event.preventDefault() },
    onClickCapture: event => {
      if (consumed.current) { consumed.current = false; event.preventDefault(); event.stopPropagation() }
    },
    onKeyDown: event => {
      if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void copy() }
    },
  }
  return { handlers, feedback: <>{status}{fallback}</>, busy, result, copy }
}
