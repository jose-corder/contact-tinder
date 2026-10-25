import { act, cleanup, renderHook } from '@testing-library/react'

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers() })

it('hydrates unexpired tab metadata, rebinds callbacks and retains original expiry after reload', async () => {
  vi.useFakeTimers()
  const at = Date.now() - 1000
  sessionStorage.setItem('ct.recoveries.v1', JSON.stringify([
    { id: 'saved', label: 'Saved recovery', at, ttlMs: 3000 },
    { id: 'expired', label: 'Old recovery', at: at - 10000, ttlMs: 1000 },
    { id: 'invalid', label: 123, at, ttlMs: 3000 },
  ]))
  const { useRecoveryStore } = await import('@/ui/recoveryStore')
  const first = renderHook(useRecoveryStore)
  expect(first.result.current.list()).toHaveLength(1)
  expect(first.result.current.list()[0]).toMatchObject({ id: 'saved', available: false })
  const onUndo = vi.fn()
  act(() => first.result.current.add({ id: 'saved', label: 'Saved recovery', at: Date.now(), onUndo, onDismiss: vi.fn() }))
  expect(first.result.current.list()[0]).toMatchObject({ at, ttlMs: 3000, available: true, onUndo })
  first.unmount()
  const next = renderHook(useRecoveryStore)
  expect(next.result.current.list()[0].onUndo).toBe(onUndo)
  act(() => vi.advanceTimersByTime(2000))
  expect(next.result.current.list()).toEqual([])
})
