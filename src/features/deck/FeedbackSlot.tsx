import { useLayoutEffect, useRef } from 'react'
import { setToastBottom } from '@/ui/toast'

/** #5: the toast's top edge docks to reserved space, below the entire chip rail. */
export function FeedbackSlot() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) setToastBottom(Math.max(0, window.innerHeight - ref.current.getBoundingClientRect().top))
  })
  useLayoutEffect(() => {
    const node = ref.current!
    const measure = () => setToastBottom(Math.max(0, window.innerHeight - node.getBoundingClientRect().top))
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    if (node.parentElement) observer?.observe(node.parentElement)
    window.addEventListener('resize', measure)
    node.parentElement?.addEventListener('scroll', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure)
      node.parentElement?.removeEventListener('scroll', measure)
      window.visualViewport?.removeEventListener('resize', measure); setToastBottom(null)
    }
  }, [])
  return <div ref={ref} className="deck-feedback-slot h-11 shrink-0" aria-hidden="true" />
}
