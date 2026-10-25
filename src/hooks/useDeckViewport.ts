import { useLayoutEffect, type RefObject } from 'react'
import { useConstrainedViewport } from '@/ui'

/** Keep tag entry inside the visible deck when the software keyboard resizes it. */
export function useDeckViewport(input: RefObject<HTMLInputElement | null>, rail: RefObject<HTMLDivElement | null>) {
  const { keyboardOpen } = useConstrainedViewport()
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const focused = !!input.current && document.activeElement === input.current
      const frame = rail.current?.closest<HTMLElement>('.deck-screen')
      frame?.style.setProperty('--deck-keyboard-inset', `${keyboardOpen && viewport ? Math.max(0, window.innerHeight - viewport.height - (viewport.offsetTop || 0)) : 0}px`)
      if (focused && keyboardOpen) rail.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
    }
    update()
    viewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    const frame = rail.current?.closest<HTMLElement>('.deck-screen')
    return () => {
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      frame?.style.removeProperty('--deck-keyboard-inset')
    }
  }, [input, rail, keyboardOpen])
  return keyboardOpen
}
