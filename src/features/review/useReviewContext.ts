import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigationType, useSearchParams } from 'react-router'
import { useScreenContext } from '@/ui'
import type { ReviewTab } from './model'

interface Context {
  tab: ReviewTab; top: number; limit: number; search: string; segment: string
  types: string[]; tags: string[]; selectedId?: string; focusId?: string
}
const isTab = (value: unknown): value is ReviewTab => ['delete', 'work', 'personal', 'unsorted'].includes(String(value))

export function useReviewContext(ready: boolean) {
  const { save, restore: restoreContext } = useScreenContext<Context>('review')
  const navigation = useNavigationType()
  const [params, setParams] = useSearchParams()
  const [saved] = useState<Context | undefined>(() => {
    try {
      const value = restoreContext()
      return navigation === 'POP' && isTab(value?.tab) && Number.isFinite(value.top) ? value : undefined
    } catch { return undefined }
  })
  const requested = params.get('tab')
  const tab = isTab(requested) ? requested : saved?.tab ?? 'delete'
  const returning = saved?.tab === tab
  const [limit, setLimit] = useState(returning ? Math.max(60, saved.limit || 60) : 60)
  const [search, setSearch] = useState(returning ? saved.search ?? '' : '')
  const [segment, setSegment] = useState(returning ? saved.segment ?? 'all' : 'all')
  const [types, setTypes] = useState<string[]>(returning ? saved.types ?? [] : [])
  const [tags, setTags] = useState<string[]>(returning ? saved.tags ?? [] : [])
  const [selectedId, setSelectedId] = useState<string | undefined>(returning ? saved.selectedId : undefined)
  const context = useRef<Context>({ tab, top: returning ? saved.top : 0, limit, search, segment, types, tags, selectedId })
  const restore = useRef(returning)
  const pendingTab = useRef<ReviewTab | undefined>(undefined)
  const persist = () => {
    save(context.current)
  }
  useLayoutEffect(() => {
    Object.assign(context.current, { tab, limit, search, segment, types, tags, selectedId,
      focusId: selectedId ? 'review-row-' + selectedId : undefined })
    persist()
    if (pendingTab.current === tab) {
      pendingTab.current = undefined
      document.getElementById('review-' + tab + '-tab')?.focus({ preventScroll: true })
      window.scrollTo({ top: context.current.top, behavior: 'instant' })
    }
    if (ready && restore.current) {
      restore.current = false
      const top = context.current.top
      window.scrollTo({ top, behavior: 'instant' })
      const frame = requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: 'instant' })
        const row = selectedId && document.getElementById('review-row-' + selectedId)
        if (row) row.focus({ preventScroll: true })
        else if (selectedId) document.querySelector<HTMLElement>('main, #main-content')?.focus({ preventScroll: true })
        else if (document.activeElement === document.body || document.activeElement?.tagName === 'MAIN') {
          document.getElementById('review-' + tab + '-tab')?.focus({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [tab, limit, ready, search, segment, types, tags, selectedId])
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
  }, [save])
  return { tab, limit, setLimit, params, setParams, search, setSearch, segment, setSegment, types, setTypes, tags, setTags, setSelectedId,
    changeTab: (value: ReviewTab) => {
    context.current = { ...context.current, tab: value, top: window.scrollY, limit: 60, selectedId: undefined, focusId: undefined }
    setSelectedId(undefined)
    persist(); setLimit(60); pendingTab.current = value
    setParams(previous => { previous.set('tab', value); return previous }, { replace: true, preventScrollReset: true })
  } }
}
