import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Tick } from '@/features/deck/DeckEnd'
import * as theme from '@/ui/theme'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('ticks from zero to the final count over 600 ms', () => {
  vi.spyOn(theme, 'prefersReducedMotion').mockReturnValue(false)
  let tick!: FrameRequestCallback
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { tick = callback; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  render(<Tick value={38} />)
  expect(screen.getByText('0')).toBeInTheDocument()
  act(() => tick(0))
  act(() => tick(300))
  expect(screen.getByText('19')).toBeInTheDocument()
  act(() => tick(600))
  expect(screen.getByText('38')).toBeInTheDocument()
})

it('shows final counts immediately under reduced motion', () => {
  vi.spyOn(theme, 'prefersReducedMotion').mockReturnValue(true)
  const raf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  render(<Tick value={38} />)
  expect(screen.getByText('38')).toBeInTheDocument()
  expect(raf).not.toHaveBeenCalled()
})
