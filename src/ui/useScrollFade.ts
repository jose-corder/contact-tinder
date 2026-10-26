import { useEffect, type RefObject } from 'react'

/**
 * Marks a scroll container with `data-fade` listing the edges past which content is hidden
 * (`top`/`bottom` for axis 'y', `left`/`right` for axis 'x'), so CSS can soften that edge instead
 * of cutting a row or tab in half. Updates on scroll, on resize and on content changes.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>, enabled = true, axis: 'x' | 'y' = 'y') {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) { el?.removeAttribute('data-fade'); return }
    const update = () => {
      const edges: string[] = []
      if (axis === 'y') {
        if (el.scrollTop > 1) edges.push('top')
        if (el.scrollHeight - el.clientHeight - el.scrollTop > 1) edges.push('bottom')
      } else {
        if (el.scrollLeft > 1) edges.push('left')
        if (el.scrollWidth - el.clientWidth - el.scrollLeft > 1) edges.push('right')
      }
      if (edges.length) el.setAttribute('data-fade', edges.join(' '))
      else el.removeAttribute('data-fade')
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined
    resize?.observe(el)
    const mutate = typeof MutationObserver !== 'undefined' ? new MutationObserver(update) : undefined
    mutate?.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      el.removeEventListener('scroll', update)
      resize?.disconnect()
      mutate?.disconnect()
      el.removeAttribute('data-fade')
    }
  }, [ref, enabled, axis])
}
