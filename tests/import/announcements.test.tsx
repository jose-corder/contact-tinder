import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { phaseSentence, useImportAnnouncement } from '@/features/import/useImportAnnouncement'
import type { ImportProgress } from '@/import/progress'

afterEach(() => vi.useRealTimers())
describe('import phase speech (#9/#34)', () => {
  it('uses sentences for every phase', () => {
    expect(['reading', 'parsing', 'deduping', 'saving'].map((phase) => phaseSentence({ phase: phase as ImportProgress['phase'], parsed: 1240 })))
      .toEqual(['Reading file', 'Parsing 1,240 contacts', 'Checking duplicates', 'Saving'])
  })
  it('throttles counts without delaying transitions or leaking obsolete announcements', () => {
    vi.useFakeTimers()
    const { result, rerender, unmount } = renderHook(({ progress, active }) => useImportAnnouncement(progress, active), {
      initialProps: { progress: { phase: 'parsing', parsed: 200 } as ImportProgress, active: true },
    })
    expect(result.current).toBe('Parsing 200 contacts')
    rerender({ progress: { phase: 'parsing', parsed: 400 }, active: true })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe('Parsing 200 contacts')
    rerender({ progress: { phase: 'parsing', parsed: 1240 }, active: true })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe('Parsing 1,240 contacts')
    rerender({ progress: { phase: 'deduping', parsed: 1 }, active: true })
    expect(result.current).toBe('Checking duplicates')
    rerender({ progress: { phase: 'saving', parsed: 1 }, active: true })
    expect(result.current).toBe('Saving')
    rerender({ progress: { phase: 'saving', parsed: 200 }, active: false })
    act(() => vi.runAllTimers())
    expect(result.current).toBe('')
    unmount()
  })
})
