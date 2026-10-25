import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { ScrollFallback, useConstrainedViewport } from '@/ui'
import { readFileSync } from 'node:fs'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.documentElement.style.fontSize = '' })

it('reacts to available height, keyboard shrink and root text size at strict thresholds', async () => {
  vi.stubGlobal('innerHeight', 800)
  const viewport = Object.assign(new EventTarget(), { height: 800 })
  vi.stubGlobal('visualViewport', viewport)
  document.documentElement.style.fontSize = '18px'
  const { result, unmount } = renderHook(useConstrainedViewport)
  expect(result.current).toEqual({ shortHeight: false, keyboardOpen: false, largeText: false })
  act(() => { viewport.height = 680; viewport.dispatchEvent(new Event('resize')) })
  expect(result.current.keyboardOpen).toBe(false)
  act(() => { viewport.height = 560; viewport.dispatchEvent(new Event('resize')) })
  expect(result.current).toEqual({ shortHeight: false, keyboardOpen: true, largeText: false })
  act(() => { viewport.height = 559; viewport.dispatchEvent(new Event('resize')) })
  expect(result.current.shortHeight).toBe(true)
  await act(async () => { document.documentElement.style.fontSize = '19px' })
  expect(result.current.largeText).toBe(true)
  const remove = vi.spyOn(viewport, 'removeEventListener')
  unmount()
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
})

it('handles landscape and rotation without visualViewport', () => {
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('innerHeight', 400)
  const { result } = renderHook(useConstrainedViewport)
  expect(result.current).toMatchObject({ shortHeight: true, keyboardOpen: false })
  act(() => { vi.stubGlobal('innerHeight', 800); window.dispatchEvent(new Event('resize')) })
  expect(result.current.shortHeight).toBe(false)
})

it('switches automatically and honors both explicit overrides without remounting children', () => {
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('innerHeight', 400)
  const { rerender } = render(<ScrollFallback data-testid="fallback"><input defaultValue="Retained" /></ScrollFallback>)
  const input = screen.getByRole('textbox')
  expect(screen.getByTestId('fallback')).toHaveAttribute('data-constrained', 'true')
  rerender(<ScrollFallback when={false} data-testid="fallback"><input /></ScrollFallback>)
  expect(screen.getByTestId('fallback')).toHaveAttribute('data-constrained', 'false')
  rerender(<ScrollFallback when data-testid="fallback"><input /></ScrollFallback>)
  expect(screen.getByTestId('fallback')).toHaveAttribute('data-constrained', 'true')
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toHaveValue('Retained')
  const css = readFileSync('src/ui/layout.css', 'utf8')
  expect(css).toContain('height: auto !important')
  expect(css).toContain('overflow: visible !important')
  expect(css).toContain('[data-scroll-stage] { min-height: 280px')
})
