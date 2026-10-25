import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { sessionStorage.clear(); vi.useRealTimers() })

it('#65: authoritative hydration rebinds missing merge callbacks, keeps original expiry and leaves moves runtime-only', async () => {
  vi.useFakeTimers()
  const at = Date.now() - 1000
  sessionStorage.setItem('ct.recoveries.v1', JSON.stringify([
    { id: 'merge', label: 'Merged A and B', at, ttlMs: 3000 },
    { id: 'removed', label: 'Merged C and D', at, ttlMs: 3000 },
    { id: 'review-old', label: 'Older move', at, ttlMs: 3000 },
  ]))
  const { recoveryStore: store } = await import('@/ui/recoveryStore')
  expect(store.list()).toHaveLength(2)
  expect(store.list()[0]).toMatchObject({ kind: 'merge', available: false })
  const onUndo = vi.fn(), onDismiss = vi.fn()
  store.add({ id: 'review-current', label: 'Current move', at: Date.now(), onUndo, onDismiss })
  store.hydrate([{ id: 'merge', label: 'Merged A and B', at, ttlMs: 3000, onUndo, onDismiss }])
  expect(store.list().map(entry => entry.id)).toEqual(['review-current', 'merge'])
  expect(store.list()[1]).toMatchObject({ at, ttlMs: 3000, available: true, onUndo })
  expect(JSON.parse(sessionStorage.getItem('ct.recoveries.v1')!)).toHaveLength(1)
  await store.list()[1].onUndo()
  expect(onUndo).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(2000)
  expect(store.list().map(entry => entry.id)).toEqual(['review-current'])
  store.hydrate([])
  expect(store.list()[0].id).toBe('review-current')
  store.remove('review-current')
})
