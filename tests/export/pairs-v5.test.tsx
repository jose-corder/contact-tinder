import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { dumpAll, getMeta, resetAll, setMeta, upsertContacts } from '@/db/repo'
import { candidatePairs, readStoredPairs, savePairResolution } from '@/import/duplicates'
import { restoreJson, restoreRevision, undoRestore } from '@/export/json'
import { restoreEntries } from '@/export/recovery'
import RestoreInput from '@/features/export/RestoreInput'
import { contact } from './fixtures'

beforeEach(resetAll)
afterEach(cleanup)
async function restorePairs() {
  const contacts = ['A', 'B', 'C'].map(id => contact(id))
  await upsertContacts(contacts)
  const pairs = candidatePairs([{ ids: ['A', 'B'], reason: 'same name' }, { ids: ['A', 'C'], reason: 'same name' }], contacts)
  await setMeta('possibleDuplicates', pairs)
  const restored = await restoreJson(JSON.stringify(await dumpAll()))
  return { ...restored, pairs }
}

it('#52: pair-only changes require review, invalidate approval, and survive a recovered rollback', async () => {
  const { restoreId, pairs } = await restorePairs()
  expect((await restoreEntries())[0].revisionAfter).toBe(await restoreRevision())
  await savePairResolution(pairs[0].id, 'kept')
  const first = await undoRestore(restoreId)
  expect(first).toMatchObject({ conflict: true, preview: { pairChanges: 1, changed: 0 } })
  if (typeof first !== 'object') throw new Error('Expected pair conflict')
  await savePairResolution(pairs[1].id, 'dismissed')
  const second = await undoRestore(restoreId, first.revision)
  expect(second).toMatchObject({ conflict: true, preview: { pairChanges: 2 } })
  if (typeof second !== 'object') throw new Error('Expected renewed review')
  expect(second.revision).not.toBe(first.revision)
  const newer = await readStoredPairs()
  expect(await undoRestore(restoreId, second.revision)).toBe(true)
  expect(await readStoredPairs()).toEqual(pairs)
  const recovery = (await restoreEntries())[0]
  expect(recovery.snapshot.pairs).toEqual(newer)
  expect(await undoRestore(recovery.id)).toBe(true)
  expect(await getMeta('possibleDuplicates', [])).toEqual(newer)
})

it('#52: mounted rollback preview names duplicate decisions and requires renewed review after another resolution', async () => {
  const { pairs } = await restorePairs()
  await savePairResolution(pairs[0].id, 'kept')
  render(<MemoryRouter><RestoreInput /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Undo restore' }))
  expect(await screen.findByText('1 duplicate decision since the restore will be lost')).toBeVisible()
  await act(async () => { await savePairResolution(pairs[1].id, 'dismissed') })
  fireEvent.click(screen.getByRole('button', { name: 'Roll back data' }))
  expect(await screen.findByText('2 duplicate decisions since the restore will be lost')).toBeVisible()
  expect((await readStoredPairs()).map(pair => pair.resolved)).toEqual(['kept', 'dismissed'])
  await waitFor(() => expect(screen.getByRole('button', { name: 'Roll back data' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Roll back data' }))
  await waitFor(async () => expect(await readStoredPairs()).toEqual(pairs))
})
