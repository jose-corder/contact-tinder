import { useLayoutEffect, useState } from 'react'

export interface ConstrainedViewport { shortHeight: boolean; keyboardOpen: boolean; largeText: boolean }
function read(): ConstrainedViewport {
  if (typeof window === 'undefined') return { shortHeight: false, keyboardOpen: false, largeText: false }
  const available = window.visualViewport?.height ?? window.innerHeight
  return { shortHeight: available < 560, keyboardOpen: window.innerHeight - available > 120,
    largeText: parseFloat(getComputedStyle(document.documentElement).fontSize) > 18 }
}

export function useConstrainedViewport(): ConstrainedViewport {
  const [flags, setFlags] = useState(read)
  useLayoutEffect(() => {
    const update = () => setFlags(previous => {
      const next = read()
      return Object.keys(next).every(key => next[key as keyof ConstrainedViewport] === previous[key as keyof ConstrainedViewport]) ? previous : next
    })
    const visual = window.visualViewport
    const root = document.documentElement
    // The rem probe also detects browser text-size changes without a window resize.
    const probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:1rem;height:1rem;contain:strict'
    document.body.append(probe)
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    resize?.observe(probe)
    const mutation = new MutationObserver(update)
    mutation.observe(root, { attributes: true, attributeFilter: ['style', 'class'] })
    window.addEventListener('resize', update)
    visual?.addEventListener('resize', update)
    visual?.addEventListener('scroll', update)
    update()
    return () => {
      window.removeEventListener('resize', update)
      visual?.removeEventListener('resize', update)
      visual?.removeEventListener('scroll', update)
      resize?.disconnect(); mutation.disconnect(); probe.remove()
    }
  }, [])
  return flags
}
