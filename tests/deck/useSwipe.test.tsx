import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { animate, type PanInfo } from 'framer-motion'
import { useSwipe } from '@/hooks/useSwipe'
import * as theme from '@/ui/theme'

vi.mock('framer-motion', async (original) => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: vi.fn((value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  }) }
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(animate).mockClear() })

it('uses the same offscreen fling and haptic for a button, committing once despite repeated input', async () => {
  const onCommit = vi.fn()
  const haptic = vi.spyOn(theme, 'haptic').mockImplementation(() => {})
  const { result } = renderHook(() => useSwipe({ onCommit }))
  await act(async () => { await Promise.all([result.current.triggerSwipe('right'), result.current.triggerSwipe('right')]) })
  expect(onCommit).toHaveBeenCalledExactlyOnceWith('right')
  expect(haptic).toHaveBeenCalledExactlyOnceWith(10)
  expect(animate).toHaveBeenCalledWith(expect.anything(), expect.any(Number), { duration: 0.32, ease: 'easeOut' })
  expect(vi.mocked(animate).mock.calls[0][1]).toBeGreaterThan(window.innerWidth)
})

it('springs back a short drag without committing', async () => {
  const onCommit = vi.fn()
  const { result } = renderHook(() => useSwipe({ onCommit }))
  const info: PanInfo = { point: { x: 30, y: 0 }, delta: { x: 30, y: 0 }, offset: { x: 30, y: 0 }, velocity: { x: 100, y: 0 } }
  act(() => result.current.onDragEnd(new MouseEvent('mouseup'), info))
  expect(onCommit).not.toHaveBeenCalled()
  expect(animate).toHaveBeenCalledWith(expect.anything(), 0, { type: 'spring', stiffness: 500, damping: 35 })
})

it('fades for 120ms with no rotation when reduced motion is requested', async () => {
  vi.spyOn(theme, 'prefersReducedMotion').mockReturnValue(true)
  const onCommit = vi.fn()
  const { result } = renderHook(() => useSwipe({ onCommit }))
  act(() => result.current.x.set(200))
  expect(result.current.rotate.get()).toBe(0)
  await act(async () => { await result.current.triggerSwipe('up') })
  expect(animate).toHaveBeenCalledTimes(1)
  expect(animate).toHaveBeenCalledWith(result.current.opacity, 0, { duration: 0.12, ease: 'easeOut' })
  expect(onCommit).toHaveBeenCalledExactlyOnceWith('up')
})

it('restores an undone card from its original side over 260ms', () => {
  const { result } = renderHook(() => useSwipe({ onCommit: vi.fn(), returnDirection: 'left' }))
  expect(animate).toHaveBeenCalledWith(result.current.x, 0, { duration: 0.26, ease: 'easeOut' })
  expect(animate).toHaveBeenCalledWith(result.current.y, 0, { duration: 0.26, ease: 'easeOut' })
})


function pan(x: number, y: number, vx = 0, vy = 0): PanInfo {
  return { point: { x, y }, delta: { x, y }, offset: { x, y }, velocity: { x: vx, y: vy } }
}

it('ignores a tap even with noisy velocity but commits an eight-pixel flick', async () => {
  const onCommit = vi.fn()
  const { result } = renderHook(() => useSwipe({ onCommit }))
  await act(async () => { result.current.onDragEnd(new MouseEvent('mouseup'), pan(5, 0, 900)) })
  expect(onCommit).not.toHaveBeenCalled()
  expect(animate).not.toHaveBeenCalled()
  await act(async () => { result.current.onDragEnd(new MouseEvent('mouseup'), pan(8, 0, 501)) })
  expect(onCommit).toHaveBeenCalledExactlyOnceWith('right')
})

it('moves through motion values without rendering on every frame and starts coaching dismissal only once', () => {
  let renders = 0
  const onDragStart = vi.fn()
  const { result } = renderHook(() => { renders++; return useSwipe({ onCommit: vi.fn(), onDragStart }) })
  const baseline = renders
  act(() => result.current.onDrag(new MouseEvent('mousemove'), pan(3, 0)))
  expect(result.current.x.get()).toBe(0)
  expect(onDragStart).not.toHaveBeenCalled()
  act(() => {
    result.current.onDrag(new MouseEvent('mousemove'), pan(12, 0))
    result.current.onDrag(new MouseEvent('mousemove'), pan(20, 200))
  })
  expect(result.current.x.get()).toBe(20)
  expect(result.current.y.get()).toBeCloseTo(49 + (200 - 49) * 0.55)
  expect(onDragStart).toHaveBeenCalledTimes(1)
  expect(renders).toBe(baseline)
  act(() => result.current.onDragEnd(new MouseEvent('mouseup'), pan(20, 200)))
  expect(result.current.committing).toBeUndefined()
})

it('cancels an interrupted gesture even past the commit threshold', async () => {
  const onCommit = vi.fn()
  const { result } = renderHook(() => useSwipe({ onCommit }))
  await act(async () => { result.current.onDragEnd(new MouseEvent('pointercancel'), pan(300, 0, 1000)) })
  expect(onCommit).not.toHaveBeenCalled()
  expect(result.current.x.get()).toBe(0)
})
