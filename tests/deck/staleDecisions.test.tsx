import { act, cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { applySwipe } from '@/domain/taxonomy'
import { emptyDecision, type Contact, type Pass } from '@/domain/types'
import { useDeck } from '@/hooks/useDeck'
import * as feedback from '@/ui/toast'

const contact = (id: string): Contact => ({ id, displayName: id, phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts(['a', 'b', 'c'].map(contact)) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); feedback.dismissToast() })
async function open(pass: Pass = 'triage') {
  const view = renderHook(() => useDeck(pass))
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  return view
}

it('deck_stale_snapshot_does_not_overwrite_another_tab: existing and never-stored rows', async () => {
  const view = await open()
  const other = applySwipe(emptyDecision('a'), 'triage', 'up', Date.now() + 50)
  await repo.saveDecision(other)
  const save = vi.spyOn(repo, 'saveDecision'), notify = vi.spyOn(feedback, 'toast')
  await act(async () => { await view.result.current.swipe('right') })
  expect(save).toHaveBeenCalledWith(expect.anything(), { expectedUpdatedAt: null })
  expect(await repo.getDecision('a')).toEqual(other)
  expect(view.result.current.top?.contact.id).toBe('b')
  expect(notify).toHaveBeenCalledWith('This contact changed elsewhere — skipped')
  view.unmount()

  await repo.saveDecision(applySwipe(emptyDecision('b'), 'triage', 'right', 10))
  const work = await open('work')
  const moved = applySwipe(await repo.getDecision('b'), 'triage', 'up', 11)
  await repo.saveDecision(moved)
  await act(async () => { await work.result.current.swipe('down') })
  expect(save).toHaveBeenLastCalledWith(expect.anything(), { exact: true, expectedUpdatedAt: 10 })
  expect(await repo.getDecision('b')).toEqual(moved)
  expect(work.result.current.remaining).toBe(0)
  expect(work.result.current.canUndo).toBe(false)
})

it.each(['triage', 'work'] as const)('deck_reset_with_open_snapshot_does_not_resurrect_decisions: %s', async (pass) => {
  if (pass === 'work') await repo.saveDecision(applySwipe(emptyDecision('a'), 'triage', 'right', 10))
  const { result } = await open(pass)
  await repo.resetAll()
  await act(async () => { await result.current.swipe('right') })
  expect(await repo.allDecisions()).toEqual([])
  expect(result.current.top?.contact.id).not.toBe('a')
})

it('undo_stale_snapshot_gives_up_without_overwriting_or_reinserting', async () => {
  const { result } = await open()
  await act(async () => { await result.current.swipe('right') })
  const other = applySwipe(await repo.getDecision('a'), 'triage', 'up', Date.now() + 50)
  await repo.saveDecision(other)
  const notify = vi.spyOn(feedback, 'toast')
  await act(async () => { await result.current.undo() })
  expect(await repo.getDecision('a')).toEqual(other)
  expect(result.current.canUndo).toBe(false)
  expect(result.current.top?.contact.id).toBe('b')
  expect(notify).toHaveBeenCalledWith('This contact changed elsewhere — skipped')
})

it('undo_repeated_skips_tracks_the_restored_version', async () => {
  const { result } = await open()
  await act(async () => { await result.current.swipe('down') })
  await act(async () => { await result.current.swipe('right') })
  await act(async () => { await result.current.swipe('right') })
  await act(async () => { await result.current.swipe('down') })
  for (let i = 0; i < 4; i++) await act(async () => { await result.current.undo() })
  expect((await repo.getDecision('a')).skips.triage).toBe(0)
  expect(result.current.remaining).toBe(3)
  expect(result.current.canUndo).toBe(false)
})

it('visibility_reconciles_membership_removes_old_cards_and_appends_new_cards', async () => {
  const { result } = await open()
  await act(async () => { await result.current.swipe('down') }) // b, c, a
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  await repo.saveDecision(applySwipe(emptyDecision('b'), 'triage', 'up'))
  await repo.upsertContacts([contact('0')])
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => { fireEvent(document, new Event('visibilitychange')) })
  await waitFor(() => expect(result.current.top?.contact.id).toBe('c'))
  expect(result.current.next?.contact.id).toBe('a')
  expect(result.current.remaining).toBe(3)
  expect(result.current.canUndo).toBe(false)
  await act(async () => { await result.current.swipe('right') })
  expect(result.current.next?.contact.id).toBe('0')
})

it('#57 pass change and unmount leave unrelated global notices alone', async () => {
  const view = renderHook(({ pass }: { pass: Pass }) => useDeck(pass), { initialProps: { pass: 'triage' } })
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  await act(async () => { await view.result.current.swipe('right') })
  const dismiss = vi.spyOn(feedback, 'dismissToast')
  view.rerender({ pass: 'work' })
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  expect(view.result.current.canUndo).toBe(false)
  expect(dismiss).not.toHaveBeenCalled()
  dismiss.mockClear()
  view.unmount()
  expect(dismiss).not.toHaveBeenCalled()
})
