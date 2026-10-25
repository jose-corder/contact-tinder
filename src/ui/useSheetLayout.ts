import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Measure real content, including footer confirmations and safe-area env() values. */
export function useSheetLayout(panel: RefObject<HTMLDivElement | null>, body: RefObject<HTMLDivElement | null>,
  header: RefObject<HTMLDivElement | null>, footer: HTMLDivElement) {
  const [layout, setLayout] = useState({ height: window.visualViewport?.height ?? window.innerHeight,
    bottom: 0, safeTop: 0, safeBottom: 0, constrained: false, sticky: true })
  const measured = useRef(layout)
  useLayoutEffect(() => {
    const visual = window.visualViewport
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--sheet-safe-top, env(safe-area-inset-top, 0px));padding-bottom:var(--sheet-safe-bottom, env(safe-area-inset-bottom, 0px));height:1rem'
    document.body.append(probe)
    const measure = () => {
      const height = visual?.height ?? window.innerHeight
      const safe = getComputedStyle(probe)
      const safeTop = parseFloat(safe.paddingTop) || 0
      const safeBottom = parseFloat(safe.paddingBottom) || 0
      const handle = header.current?.querySelector('button')
      const title = header.current?.querySelector('h2')
      // Measure the expanded header even while its title slot is collapsed.
      const headerHeight = (handle?.getBoundingClientRect().height || 44) +
        (title && !title.classList.contains('sr-only') ? Math.max(32, title.scrollHeight) + 12 : 0)
      const footerHeight = footer.getBoundingClientRect().height
      const usable = Math.max(0, height - safeTop - safeBottom)
      const cap = Math.min(window.innerHeight * .85, height - Math.max(24, safeTop) - safeBottom)
      const constrained = headerHeight + footerHeight + 120 > Math.min(usable, cap)
      const bodyHeight = body.current?.getBoundingClientRect().height ?? 0
      // A tall sticky confirmation must scroll normally rather than cover the fields.
      const sticky = footerHeight + 120 <= bodyHeight
      const next = { height, safeTop, safeBottom, constrained, sticky,
        bottom: visual ? Math.max(0, window.innerHeight - height - visual.offsetTop) : 0 }
      if (!Object.keys(next).every(key => next[key as keyof typeof next] === measured.current[key as keyof typeof next])) {
        measured.current = next
        setLayout(next)
      }
    }
    measure()
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    for (const node of [panel.current, header.current, body.current, footer, probe]) if (node) resize?.observe(node)
    const mutation = new MutationObserver(measure)
    if (panel.current) mutation.observe(panel.current, { childList: true, subtree: true, characterData: true })
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
    visual?.addEventListener('resize', measure)
    visual?.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    return () => {
      resize?.disconnect(); mutation.disconnect(); probe.remove()
      visual?.removeEventListener('resize', measure)
      visual?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [panel, body, header, footer])
  return layout
}
