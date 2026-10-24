import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCoach } from '@/hooks/useCoach'
import { DeckCoach } from '@/features/deck/DeckCoach'
import { dismissDeckCoaches } from './helpers'

beforeEach(() => { for (const pass of ['triage', 'work', 'personal']) window.localStorage.removeItem('ct.coach.' + pass) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); dismissDeckCoaches() })

it('shows independently for each pass and persists dismissal through a remount', () => {
  const first = renderHook(() => useCoach('triage'))
  expect(first.result.current.visible).toBe(true)
  act(() => first.result.current.dismiss())
  expect(first.result.current.visible).toBe(false)
  first.unmount()
  expect(renderHook(() => useCoach('triage')).result.current.visible).toBe(false)
  expect(renderHook(() => useCoach('work')).result.current.visible).toBe(true)
  expect(renderHook(() => useCoach('personal')).result.current.visible).toBe(true)
})

it('dismisses for this session even if persistent storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Private mode') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Private mode') })
  const { result } = renderHook(() => useCoach('triage'))
  act(() => result.current.dismiss())
  expect(result.current.visible).toBe(false)
})

it('uses the pass outcomes and provides an explicit dismiss button', () => {
  const dismiss = vi.fn()
  render(<DeckCoach pass="work" dismiss={dismiss} />)
  for (const label of ['Old', 'Current', 'Potential', 'Skip']) expect(screen.getByText(label)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(dismiss).toHaveBeenCalledTimes(1)
})
