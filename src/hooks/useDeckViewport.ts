import { useLayoutEffect, useState, type RefObject } from 'react'

/** Keep tag entry inside the visible deck when the software keyboard resizes it. */
export function useDeckViewport(input: RefObject<HTMLInputElement | null>, rail: RefObject<HTMLDivElement | null>) {
  const [keyboard, setKeyboard] = useState(false)
  useLayoutEffect(() => {
    if (keyboard && document.activeElement !== input.current) {
      setKeyboard(false)
      rail.current?.closest<HTMLElement>('.deck-screen')?.style.removeProperty('--deck-height')
    }
  })
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const focused = !!input.current && document.activeElement === input.current
      const shrunk = !!viewport && viewport.height < window.innerHeight - 80
      setKeyboard(focused && shrunk)
      const frame = rail.current?.closest<HTMLElement>('.deck-screen')
      frame?.style.setProperty('--deck-height', `${focused && shrunk ? viewport!.height : window.innerHeight}px`)
      if (focused && shrunk) rail.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
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
      frame?.style.removeProperty('--deck-height')
    }
  }, [input, rail])
  return keyboard
}
