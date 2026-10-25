import { useEffect, useRef } from 'react'

/** #62: same-path workspace transitions are independent of ordinary tab changes. */
export function usePairModeFocus(active: boolean, tab: string, listTop: number) {
  const previous = useRef<boolean | undefined>(undefined)
  const top = useRef(listTop)
  useEffect(() => {
    if (previous.current === active) return
    const exiting = previous.current === true
    previous.current = active
    if (active) {
      top.current = listTop
      document.getElementById('review-pairs-heading')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else if (exiting) {
      const target = document.getElementById('review-duplicates') ?? document.getElementById('review-' + tab + '-tab')
      target?.focus({ preventScroll: true })
      window.scrollTo({ top: top.current, behavior: 'instant' })
    }
  }, [active, tab, listTop])
}
