import { recoveryStore } from '@/ui/recoveryStore'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import * as notices from '@/ui/toast'
import { getToast } from '@/ui/toastStore'
import { snapshotUnchanged, rowUndoToast, undoDecisions } from '@/features/review/undo'
import BulkBar from '@/features/review/BulkBar'
import ReviewRow from '@/features/review/ReviewRow'
import { row } from '../export/fixtures'

beforeEach(repo.resetAll)
afterEach(() => { cleanup(); recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id)); while (getToast()) notices.dismissToast(); vi.restoreAllMocks() })

it('#55/#5: a move pre-empts a long notice and its Undo rejects an intervening edit', async () => {
  const item = row('Maria', { bucket: 'work', updatedAt: 1 })
  await repo.upsertContacts([item.contact]); await repo.saveDecision(item.decision)
  notices.toast('Restore', { priority: 'high', duration: 600000 })
  const toast = vi.spyOn(notices, 'toast')
  render(<><ReviewRow row={item} selecting={false} selected={false} onOpen={vi.fn()} onToggle={vi.fn()} onLongPress={vi.fn()} /><notices.Toaster /></>)
  fireEvent.keyDown(screen.getByRole('button', { name: /^View Maria/ }), { key: 'ArrowLeft' })
  fireEvent.click(screen.getByRole('button', { name: 'Move Maria to Personal' }))
  await screen.findByText('Maria → Personal')
  const options = toast.mock.calls.find(([message]) => message === 'Maria → Personal')![1]!
  const moved = await repo.getDecision('Maria')
  expect(options.validUntil?.()).toBe(true)
  await act(async () => { await repo.saveDecision({ ...moved, customTags: ['new'], updatedAt: moved.updatedAt + 1 }) })
  await waitFor(() => expect(options.validUntil?.()).toBe(false))
  // Exercise the race-safe callback too, even if invoked before the live validity check updates.
  act(() => options.action!.onClick())
  expect(await screen.findByText('Changed since — not undone')).toBeInTheDocument()
  expect((await repo.getDecision('Maria')).customTags).toEqual(['new'])
})

it('#55: single Undo passes the exact expected version and dismisses only its handle', async () => {
  await repo.upsertContacts([row('A').contact]) // #61: existence is part of recovery's guard.
  const before = row('A', { bucket: 'work', updatedAt: 1 }).decision
  const after = { ...before, bucket: 'delete' as const, updatedAt: 2 }
  await repo.saveDecision(after)
  const save = vi.spyOn(repo, 'saveDecision')
  const first = rowUndoToast(before, after, 'Moved A', 'delete')
  const callback = getToast()!.action!.onClick
  notices.toast('Newer action', { priority: 'high' })
  callback()
  await waitFor(() => expect(save).toHaveBeenCalledWith(before, { exact: true, expectedDecision: after, requireContact: true }))
  await waitFor(async () => expect(await repo.getDecision('A')).toEqual(before))
  expect(getToast()?.message).toBe('Newer action')
  notices.dismissToast()
  expect(getToast()?.id).not.toBe(first.id)
})

it('#55: bulk Undo checks every row atomically and retains newer decisions and tag counts', async () => {
  const before = [row('A', { bucket: 'work', updatedAt: 1 }).decision, row('B', { bucket: 'work', updatedAt: 1 }).decision]
  const after = before.map(d => ({ ...d, bucket: 'personal' as const, customTags: ['bulk'], updatedAt: 2 }))
  await repo.saveDecisions(after)
  await repo.saveDecision({ ...after[1], customTags: ['newer'], updatedAt: 3 })
  const tags = await db.tags.toArray()
  await expect(undoDecisions({ before, after })).rejects.toBeInstanceOf(repo.StaleDecisionError)
  expect(await repo.getDecision('A')).toEqual(after[0])
  expect((await repo.getDecision('B')).customTags).toEqual(['newer'])
  expect(await db.tags.toArray()).toEqual(tags)
})

it('#55: bulk persistent Undo reports none undone when one row is stale', async () => {
  const rows = ['A', 'B'].map(id => row(id, { bucket: 'work', updatedAt: 1 }))
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
  render(<BulkBar rows={rows} onClear={vi.fn()} onSelectAll={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Move to…' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Personal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await screen.findByRole('button', { name: 'Undo last action' })
  const b = await repo.getDecision('B')
  await act(async () => { await repo.saveDecision({ ...b, updatedAt: b.updatedAt + 1, customTags: ['newer'] }) })
  fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }))
  expect(await screen.findByText('Changed since — none undone')).toBeInTheDocument()
  expect((await repo.getDecision('A')).bucket).toBe('personal')
  await waitFor(() => expect(snapshotUnchanged({ before: [b], after: [b] })).toBe(false))
})
