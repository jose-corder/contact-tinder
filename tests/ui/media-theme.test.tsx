import { act, cleanup, renderHook } from '@testing-library/react'
import { useMediaQuery } from '@/ui'
import { applyTheme, initTheme, setThemePref, syncThemeColor } from '@/ui/theme'

function mockMedia(initial = false) {
  let matches = initial
  const listeners = new Set<() => void>()
  const media = {
    get matches() { return matches }, media: '', onchange: null,
    addEventListener: vi.fn((_: string, callback: () => void) => listeners.add(callback)),
    removeEventListener: vi.fn((_: string, callback: () => void) => listeners.delete(callback)),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return { media, listeners, change: (next: boolean) => { matches = next; listeners.forEach((callback) => callback()) } }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
  document.documentElement.removeAttribute('data-theme')
  window.localStorage.clear()
})

it('reads media matches, responds to changes and unsubscribes', () => {
  const mock = mockMedia(true)
  const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 600px)'))
  expect(result.current).toBe(true)
  act(() => mock.change(false))
  expect(result.current).toBe(false)
  unmount()
  expect(mock.listeners.size).toBe(0)
})

it('resubscribes when the query changes', () => {
  const mock = mockMedia()
  const { rerender } = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query: '(min-width: 600px)' } })
  rerender({ query: '(prefers-reduced-motion: reduce)' })
  expect(window.matchMedia).toHaveBeenLastCalledWith('(prefers-reduced-motion: reduce)')
  expect(mock.media.removeEventListener).toHaveBeenCalled()
  expect(mock.listeners.size).toBe(1)
})

it('returns false without matchMedia', () => {
  vi.stubGlobal('matchMedia', undefined)
  expect(renderHook(() => useMediaQuery('print')).result.current).toBe(false)
})

function metas() {
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#F4EFE6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">')
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
}

it('syncs both theme-color entries to a manual choice over the system theme', () => {
  mockMedia(true)
  const entries = metas()
  setThemePref('light')
  entries.forEach((meta) => { expect(meta.content).toBe('#F4EFE6'); expect(meta).not.toHaveAttribute('media') })
  applyTheme('dark')
  entries.forEach((meta) => expect(meta.content).toBe('#121110'))
})

it('follows system changes while preserving a manual preference', () => {
  const mock = mockMedia()
  const entries = metas()
  const dispose = initTheme()
  mock.change(true)
  expect(entries[0].content).toBe('#121110')
  setThemePref('light')
  mock.change(false)
  mock.change(true)
  expect(entries[0].content).toBe('#F4EFE6')
  applyTheme('system')
  syncThemeColor()
  expect(entries[0].content).toBe('#121110')
  dispose()
  expect(mock.listeners.size).toBe(0)
})
