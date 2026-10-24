import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { db } from '@/db/schema'
import { allDecisions, resetAll, upsertContacts } from '@/db/repo'
import * as repo from '@/db/repo'
import BulkBar from '@/features/review/BulkBar'
import ReviewScreen from '@/features/review/ReviewScreen'
import { dismissToast, Toaster } from '@/ui/toast'
import { row } from '../export/fixtures'

beforeEach(resetAll)
afterEach(() => { cleanup(); dismissToast() })

it.each(['move', 'tag', 'reset'] as const)('bulk_mutation_rolls_back_on_row_501: %s', async (operation) => {
  const rows = Array.from({ length: 1000 }, (_, i) => row(`Person ${i}`, {
    bucket: 'work', workStatus: 'current', customTags: ['original'],
  }))
  await upsertContacts(rows.map(({ contact }) => contact))
  // Seed in bulk; the UI operation below still exercises real atomic saveDecisions.
  await db.decisions.bulkPut(rows.map(({ decision }) => decision))
  await db.tags.put({ name: 'original', count: rows.length })
  const before = await allDecisions()
  const tags = await db.tags.toArray()
  let writes = 0
  const rejectRow501 = () => { if (++writes === 501) throw new Error('Injected storage failure') }
  db.decisions.hook('updating', rejectRow501)
  const clear = vi.fn()
  const save = vi.spyOn(repo, 'saveDecisions')
  try {
    if (operation === 'reset') {
      render(<MemoryRouter initialEntries={['/review?tab=work']}><ReviewScreen /><Toaster /></MemoryRouter>)
      fireEvent.click(await screen.findByRole('button', { name: 'Re-swipe these' }))
      expect(screen.getByRole('button', { name: 'Re-swipe these' })).toHaveAttribute('aria-busy', 'true')
    } else {
      render(<><BulkBar rows={rows} onClear={clear} onSelectAll={vi.fn()} /><Toaster /></>)
      fireEvent.click(screen.getByRole('button', { name: operation === 'move' ? 'Move to…' : 'Tag…' }))
      const dialog = within(screen.getByRole('dialog'))
      if (operation === 'tag') fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'new-tag' } })
      fireEvent.click(dialog.getByRole('button', { name: operation === 'move' ? 'Personal' : 'Add tag' }))
      expect(screen.getByRole('button', { name: 'Move to…' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: 'Tag…' })).toBeDisabled()
    }
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    // Await the real batch instead of repeatedly scanning 60 rendered rows during 501 IDB writes.
    await act(async () => { await (save.mock.results[0].value as Promise<void>).catch(() => {}) })
    await screen.findByText('Nothing was changed')
    expect(writes).toBe(501)
    expect(await allDecisions()).toEqual(before)
    expect(await db.tags.toArray()).toEqual(tags)
    expect(clear).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: operation === 'reset' ? 'Re-swipe these' : 'Move to…' })).toBeEnabled())
  } finally { db.decisions.hook('updating').unsubscribe(rejectRow501); save.mockRestore() }
}, 30000)
