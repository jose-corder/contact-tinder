import { useLayoutEffect, useRef, type RefObject } from 'react'

interface Position { top: number; left: number }
interface Context { selector?: string; position: Position }

// A structural fallback also works for controls without IDs, including generated React IDs.
function selectorFor(element: HTMLElement, root: HTMLElement): string {
  const parts: string[] = []
  let node: HTMLElement | null = element
  while (node && node !== root) {
    if (node.id && !node.id.startsWith('_r_') && !node.id.startsWith(':r')) {
      parts.unshift(`[id=${JSON.stringify(node.id)}]`)
      break
    }
    const siblings: Element[] = [...(node.parentElement?.children ?? [])].filter(child => child.tagName === node!.tagName)
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`)
    node = node.parentElement
  }
  return parts.join(' > ')
}

export function useRouteFocus(pathname: string, navigation: string, page: RefObject<HTMLElement | null>) {
  const contexts = useRef(new Map<string, Context>())
  const previousPath = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const original = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = original }
  }, [])
  useLayoutEffect(() => {
    const root = page.current
    if (!root) return
    const changed = previousPath.current !== undefined && previousPath.current !== pathname
    previousPath.current = pathname
    const saved = contexts.current.get(pathname)
    const restore = () => window.scrollTo({ ...(navigation === 'POP' ? saved?.position : undefined) ?? { top: 0, left: 0 }, behavior: 'instant' })
    const activeRoot = () => document.querySelector<HTMLElement>(`[data-route-path=${JSON.stringify(pathname)}]:not([inert])`)
    let focused = false
    const restoreFocus = () => {
      const activePage = activeRoot()
      if (!activePage?.isConnected || activePage.dataset.routePath !== pathname || activePage.closest('[inert]')) return
      const main = activePage.tagName === 'MAIN' ? activePage : activePage.querySelector<HTMLElement>('main') ?? activePage
      if (navigation === 'PUSH' || navigation === 'POP') {
        const remembered = navigation === 'POP' && saved?.selector ? activePage.querySelector<HTMLElement>(saved.selector) : null
        const target = remembered && !remembered.matches(':disabled') && !remembered.closest('[hidden], [inert]') ? remembered : main
        if (target === main) target.tabIndex = -1
        target.focus({ preventScroll: true })
        focused = true
      }
    }
    if (changed) { restoreFocus(); restore() }
    // AnimatePresence can revive an exiting page during a rapid Back navigation.
    const frame = changed ? requestAnimationFrame(() => {
      if (!focused || document.activeElement === document.body || document.activeElement?.closest('[inert]')) restoreFocus()
      restore()
    }) : undefined
    let selector = saved?.selector
    const remember = (event: FocusEvent) => {
      const target = event.target
      const activePage = activeRoot()
      if (target instanceof HTMLElement && activePage?.contains(target) && !target.closest('[inert]')) selector = selectorFor(target, activePage)
    }
    document.addEventListener('focusin', remember)
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      document.removeEventListener('focusin', remember)
      contexts.current.delete(pathname)
      contexts.current.set(pathname, { selector, position: { top: window.scrollY, left: window.scrollX } })
      if (contexts.current.size > 20) contexts.current.delete(contexts.current.keys().next().value!)
    }
    // Search/history-entry changes deliberately retain the active screen and its focus listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, page])
}

