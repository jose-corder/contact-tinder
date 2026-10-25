import { useCallback, useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** Explicit JSON snapshot persistence, isolated by pathname and caller key. */
export function useScreenContext<T = unknown>(key: string) {
  const { pathname } = useLocation()
  const navigation = useNavigationType()
  const storageKey = `ct.screen.${JSON.stringify([pathname, key])}`
  const save = useCallback((snapshot: T) => {
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot)) } catch { /* unavailable storage */ }
  }, [storageKey])
  const restore = useCallback((): T | null => {
    try {
      const value = window.sessionStorage.getItem(storageKey)
      return value === null ? null : JSON.parse(value) as T
    } catch { return null }
  }, [storageKey])
  useEffect(() => {
    if (navigation !== 'POP') return
    const snapshot = restore()
    if (!snapshot || typeof snapshot !== 'object' || !('focusId' in snapshot) || typeof snapshot.focusId !== 'string') return
    const focusId = snapshot.focusId
    // Run after route focus and after consumers have rendered the restored snapshot.
    const frame = requestAnimationFrame(() => {
      const page = [...document.querySelectorAll<HTMLElement>('[data-route-path]')]
        .find(node => node.dataset.routePath === pathname && !node.closest('[inert]'))
      const main = page?.matches('main') ? page : page?.querySelector<HTMLElement>('main')
        ?? document.querySelector<HTMLElement>('main:not([inert]), #main-content:not([inert])')
      const remembered = document.getElementById(focusId)
      const usable = remembered && (!page || page.contains(remembered)) &&
        !remembered.matches(':disabled') && !remembered.closest('[inert], [hidden], [aria-hidden="true"]') &&
        getComputedStyle(remembered).display !== 'none' && getComputedStyle(remembered).visibility !== 'hidden'
      const target = usable ? remembered : main
      if (target) {
        if (target.tabIndex < 0) target.tabIndex = -1
        target.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(frame)
    // Query-only replacements retain the active screen and focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, restore])
  return { save, restore }
}
