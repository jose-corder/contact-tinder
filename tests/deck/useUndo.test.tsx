import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { emptyDecision } from '@/domain/types'
import { useUndo, type UndoEntry } from '@/hooks/useUndo'

const entry = (index: number): UndoEntry => {
  const id = String(index)
  const decision = emptyDecision(id)
  return { item: { contact: { id, displayName: id, phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }, decision }, prevDecision: decision, direction: 'right' }
}
beforeEach(async () => { await repo.resetAll() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('retains only the last twenty decisions, saves snapshots, and returns the exit direction', async () => {
  const restore = vi.fn()
  const { result } = renderHook(() => useUndo(restore))
  act(() => { for (let i = 0; i < 22; i++) result.current.push(entry(i)) })
  for (let i = 21; i >= 2; i--) {
    await act(async () => { expect(await result.current.undo()).toBe('right') })
    expect(restore.mock.lastCall?.[0].item.contact.id).toBe(String(i))
  }
  expect(result.current.canUndo).toBe(false)
  expect(restore).toHaveBeenCalledTimes(20)
  expect((await repo.getDecision('21')).bucket).toBeUndefined()
})

it('keeps failed undo entries available for retry', async () => {
  const restore = vi.fn()
  const { result } = renderHook(() => useUndo(restore))
  act(() => result.current.push(entry(1)))
  vi.spyOn(repo, 'saveDecision').mockRejectedValueOnce(new Error('Unavailable'))
  await act(async () => { await expect(result.current.undo()).rejects.toThrow('Unavailable') })
  expect(result.current.canUndo).toBe(true)
  expect(restore).not.toHaveBeenCalled()
  await act(async () => { await result.current.undo() })
  expect(restore).toHaveBeenCalledTimes(1)
})
