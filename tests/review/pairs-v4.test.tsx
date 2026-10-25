import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { candidatePairs, readPossibleDuplicates } from '@/import/duplicates'
import { vcfText } from '@/export/vcf'
import ReviewScreen from '@/features/review/ReviewScreen'
import { recoveryStore } from '@/ui'
import { row } from '../export/fixtures'

beforeEach(async () => {
  recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id))
  await repo.resetAll(); window.sessionStorage.clear()
})
afterEach(() => { cleanup(); recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id)); vi.restoreAllMocks() })
function open() { return render(<MemoryRouter initialEntries={['/review?tab=work&dupes=1']}><ReviewScreen /></MemoryRouter>) }
async function seed(conflict = true) {
  const items = [row('A', { bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['studio'] }),
    row('B', conflict ? { bucket: 'personal', relation: 'family', personalTypes: ['neighbor'], customTags: ['school'] } : {})]
  items.forEach(item => { item.contact.phones = [{ value: '+12025550101', e164: '+12025550101' }]; item.contact.phoneKeys = ['+12025550101'] })
  items[1].contact.emails = [{ value: 'counterpart@example.com' }]
  await repo.upsertContacts([...items.map(item => item.contact), row('Unrelated').contact])
  await repo.saveDecisions(items.map(item => item.decision), { exact: true })
  await repo.setMeta('possibleDuplicates', candidatePairs([{ ids: ['A', 'B'], reason: 'shared phone' }], items.map(item => item.contact)))
  return items
}

it('#54: Work/Unsorted pair is the only scope; search and filters match either member', async () => {
  await seed(false); open()
  expect(await screen.findByRole('heading', { name: 'Possible duplicates · 1' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'A and B' })).toBeVisible()
  for (const name of ['Select', 'Sort again', 'Move to…']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Contacts' })).not.toBeInTheDocument()
  expect(screen.queryByText(/of .* match/)).not.toBeInTheDocument()
  expect(screen.queryByText('Unrelated')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'counterpart@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Work' }))
  fireEvent.click(screen.getByRole('button', { name: 'Unsorted' }))
  expect(screen.getByRole('article', { name: 'A and B' })).toBeVisible()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Unrelated' } })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByText('No matching pairs.')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: 'Back to list' }))
  expect(await screen.findByRole('button', { name: /^View A/ })).toBeVisible()
  expect(screen.getByRole('tab', { name: /^Work/ })).toHaveAttribute('aria-selected', 'true')
})

it('#58: cancelling a conflict comparison makes no writes', async () => {
  await seed(); const before = await repo.dumpAll(), pairs = await readPossibleDuplicates(), tags = await db.tags.toArray()
  open(); fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
  const dialog = within(screen.getByRole('dialog'))
  expect(await dialog.findByText('Saved classification: Work · Current · Client · studio')).toBeVisible()
  expect(dialog.getByText('Saved classification: Personal · Family · Neighbor · school')).toBeVisible()
  expect(dialog.getByText('Shared phone: +12025550101')).toBeVisible()
  expect(dialog.getByText('Why this pair: shared phone')).toBeVisible()
  expect(dialog.getByRole('region', { name: 'Proposed survivor' })).toHaveTextContent('Keep A')
  expect(dialog.getByRole('button', { name: 'Merge contacts' })).toBeDisabled()
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel merge' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect((await repo.dumpAll()).contacts).toEqual(before.contacts)
  expect(await repo.allDecisions()).toEqual(before.decisions)
  expect(await readPossibleDuplicates()).toEqual(pairs)
  expect(await db.tags.toArray()).toEqual(tags)
})

it.each(["Keep A's", "Keep B's", 'Combine'])('#58/#61: %s previews the persisted/exported classification and Undo restores both records and pairs', async choice => {
  const items = await seed(), pairs = await readPossibleDuplicates(), tags = await db.tags.toArray()
  open(); fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.click(await dialog.findByRole('radio', { name: choice }))
  const personal = choice === "Keep B's"
  expect(dialog.getByText(/^Result:/)).toHaveTextContent(personal ? 'Personal · Family · Neighbor' : 'Work · Current · Client')
  fireEvent.click(dialog.getByRole('button', { name: 'Merge contacts' }))
  expect(await screen.findByText('All reviewed')).toBeVisible()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const saved = await repo.getDecision('A')
  expect(saved.bucket).toBe(personal ? 'personal' : 'work')
  expect(saved.customTags).toEqual(['studio', 'school'])
  if (choice === 'Combine') expect(saved.personalTypes).toEqual(['neighbor'])
  const exported = vcfText((await repo.allWithDecisions()).filter(item => item.contact.id === 'A'))
  expect(exported).toContain(personal ? 'Personal,Family,Neighbor' : 'Work,Current,Client')
  expect(await repo.contactById('B')).toBeUndefined()
  expect(await screen.findByText('Merged A and B')).toBeVisible() // #65: hydrate from the committed repository entry.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(async () => expect(await repo.contactById('B')).toEqual(items[1].contact))
  expect(await repo.contactById('A')).toEqual(items[0].contact)
  expect(await repo.allDecisions()).toEqual(items.map(item => item.decision))
  expect(await readPossibleDuplicates()).toEqual(pairs)
  expect(await db.tags.toArray()).toEqual(tags)
})

it('#58: merge recovery rejects subsequent edits and remains listed for dismissal', async () => {
  await seed(); open(); fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
  fireEvent.click(await screen.findByRole('radio', { name: "Keep A's" }))
  fireEvent.click(screen.getByRole('button', { name: 'Merge contacts' }))
  await screen.findByText('All reviewed')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const decision = await repo.getDecision('A')
  await act(async () => { await repo.saveDecision({ ...decision, customTags: ['later edit'] }, { exact: true }) })
  // #65: both recovery surfaces now observe conflicts before the Undo click.
  expect(await screen.findByRole('button', { name: 'Changed since' })).toBeDisabled()
  expect((await repo.getDecision('A')).customTags).toEqual(['later edit'])
  expect(await repo.contactById('B')).toBeUndefined()
  const recovery = within(screen.getByRole('region', { name: 'Pending recoveries' }))
  fireEvent.click(recovery.getByRole('button', { name: 'Dismiss' }))
  await waitFor(() => expect(screen.queryByText('Merged A and B')).not.toBeInTheDocument())
})
