import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router'
import type { ReviewTab } from './model'

interface Context { tab: ReviewTab; top: number; limit: number }
const isTab = (value: unknown): value is ReviewTab => ['delete', 'work', 'personal', 'unsorted'].includes(String(value))

export function useReviewContext(ready: boolean) {
  const { pathname } = useLocation()
  const navigation = useNavigationType()
  const [params, setParams] = useSearchParams()
  const key = 'ct.review:' + pathname
  const [saved] = useState<Context | undefined>(() => {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
      return navigation === 'POP' && isTab(value?.tab) && Number.isFinite(value.top) ? value : undefined
    } catch { return undefined }
  })
  const requested = params.get('tab')
  const tab = isTab(requested) ? requested : saved?.tab ?? 'delete'
  const returning = saved?.tab === tab
  const [limit, setLimit] = useState(returning ? Math.max(60, saved.limit || 60) : 60)
  const context = useRef<Context>({ tab, top: returning ? saved.top : 0, limit })
  const restore = useRef(returning)
  const pendingTab = useRef(false)
  const persist = () => {
    try { window.sessionStorage.setItem(key, JSON.stringify(context.current)) } catch { /* private browsing */ }
  }
  useLayoutEffect(() => {
    context.current.tab = tab
    context.current.limit = limit
    if (pendingTab.current) {
      pendingTab.current = false
      document.getElementById('review-' + tab + '-tab')?.focus({ preventScroll: true })
      window.scrollTo({ top: context.current.top, behavior: 'instant' })
    }
    if (ready && restore.current) {
      restore.current = false
      const top = context.current.top
      window.scrollTo({ top, behavior: 'instant' })
      const frame = requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: 'instant' })
        if (document.activeElement === document.body || document.activeElement?.tagName === 'MAIN') {
          document.getElementById('review-' + tab + '-tab')?.focus({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [tab, limit, ready])
  useEffect(() => {
    const remember = () => {
      const activeTab = document.getElementById('review-' + context.current.tab + '-tab')
      if (!activeTab || activeTab.closest('[inert]') || document.body.style.position === 'fixed') return
      context.current.top = window.scrollY; persist()
    }
    window.addEventListener('scroll', remember, { passive: true })
    document.addEventListener('click', remember, true)
    return () => { window.removeEventListener('scroll', remember); document.removeEventListener('click', remember, true); persist() }
    // The pathname owns this session record; query changes keep the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { tab, limit, setLimit, params, setParams, changeTab: (value: ReviewTab) => {
    context.current = { tab: value, top: window.scrollY, limit: 60 }
    persist(); setLimit(60); pendingTab.current = true
    setParams(previous => { previous.set('tab', value); return previous }, { replace: true, preventScrollReset: true })
  } }
}
