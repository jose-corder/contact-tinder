import { recoveryStore } from '@/ui/recoveryStore'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { candidatePairs, readPossibleDuplicates } from '@/import/duplicates'
import { metadata } from '@/import/metadata'
import ReviewScreen from '@/features/review/ReviewScreen'
import RowSheet from '@/features/review/RowSheet'
import { getToast } from '@/ui/toastStore'
import { dismissToast } from '@/ui/toast'
import { row } from '../export/fixtures'

beforeEach(async () => { await repo.resetAll(); window.sessionStorage.clear() })
afterEach(() => { cleanup(); recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id)); while (getToast()) dismissToast(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('#53: Other filters and editor use only the saved relation, then type edits persist completion', async () => {
  const legacy = row('Legacy', { bucket: 'personal', personalTypes: ['neighbor'] })
  const explicit = row('Saved', { bucket: 'personal', relation: 'other' })
  await repo.upsertContacts([legacy.contact, explicit.contact])
  // Deliberately bypass normalization to represent a pre-migration saved draft.
  await db.decisions.bulkPut([legacy.decision, explicit.decision])
  render(<MemoryRouter initialEntries={['/review?tab=personal']}><ReviewScreen /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'View Legacy, Personal, Neighbor' }))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'false')
  expect(dialog.getByText('Choosing a type saves this contact as Other until you pick a relation')).toBeVisible()
  fireEvent.click(dialog.getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('radio', { name: 'Other' }))
  expect(screen.queryByRole('button', { name: /^View Legacy/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View Saved, Personal, Other' })).toBeInTheDocument()
  expect((await repo.getDecision('Legacy')).relation).toBeUndefined()
})

async function seedPair() {
  const rows = [row('Existing', { bucket: 'work' }), row('Incoming')]
  rows[0].contact.org = 'Studio'; rows[1].contact.org = 'School'
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
  const pairs = candidatePairs([{ ids: ['Existing', 'Incoming'], reason: 'shared phone' }], rows.map(r => r.contact))
  await repo.setMeta('possibleDuplicates', pairs)
  return pairs[0]
}

it.each(['work', 'personal', 'delete', 'unsorted'])('#54/#35: duplicate counterparts and reason are visible across the %s tab', async tab => {
  await seedPair()
  render(<MemoryRouter initialEntries={['/review?tab=' + tab + '&dupes=1']}><ReviewScreen /></MemoryRouter>)
  const panel = within(await screen.findByRole('region', { name: 'Possible duplicates' }))
  for (const text of ['Existing', 'Incoming', 'Studio', 'School', 'shared phone']) expect(panel.getByText(text)).toBeVisible()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to list' })).toHaveAttribute('href', '/review?tab=' + tab)
})

it.each(['Keep both', 'Dismiss', 'Merge'])('#54: %s resolves the pair durably and shows All reviewed', async action => {
  await seedPair()
  const view = render(<MemoryRouter initialEntries={['/review?dupes=1']}><ReviewScreen /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: action }))
  if (action === 'Merge') {
    // #58: inspect and explicitly confirm before the mutation.
    await screen.findByText('Saved classification: Work')
    fireEvent.click(screen.getByRole('button', { name: 'Merge contacts' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  }
  expect(await screen.findByText('All reviewed')).toBeInTheDocument()
  expect((await readPossibleDuplicates()).filter(pair => !pair.resolved)).toHaveLength(0)
  if (action === 'Merge') {
    expect(await repo.contactById('Incoming')).toBeUndefined()
    expect(screen.getByRole('region', { name: 'Pending recoveries' })).toHaveTextContent('Merged Existing and Incoming')
  } else expect((await readPossibleDuplicates())[0].resolved).toBe(action === 'Keep both' ? 'kept' : 'dismissed')
  view.unmount()
  render(<MemoryRouter initialEntries={['/review?dupes=1']}><ReviewScreen /></MemoryRouter>)
  expect(await screen.findByText('All reviewed')).toBeInTheDocument()
})

it('#23/#46: identity precedes classification and secondary merged source fields use the shared list', () => {
  const item = row('Merged', { bucket: 'work' })
  item.contact.phones = [{ value: '555-0101' }]; item.contact.emails = [{ value: 'a@example.com' }]
  item.contact.raw = 'BEGIN:VCARD\nFN:Merged\nEND:VCARD'
  metadata(item.contact).rawCards = ['BEGIN:VCARD\nFN:Secondary\nX-SECONDARY:Only in merged source\nEND:VCARD']
  render(<MemoryRouter><RowSheet row={item} onClose={vi.fn()} /></MemoryRouter>)
  const identity = screen.getByRole('region', { name: 'Contact identity' })
  expect(identity.compareDocumentPosition(screen.getByRole('region', { name: 'Classification' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  for (const name of ['Merged', '555-0101', 'a@example.com']) expect(within(identity).getByRole('button', { name: 'Copy ' + name })).toBeVisible()
  fireEvent.click(screen.getByText('All fields'))
  expect(screen.getByText('Only in merged source').closest('.field-list')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Original contact record 2'))
  expect(screen.getByText(/BEGIN:VCARD.*FN:Secondary/s)).toBeVisible()
})

it('#14/#38: Review and row sheet activate the shared fallback when the viewport shrinks', async () => {
  const item = row('Short', { bucket: 'work' })
  await repo.upsertContacts([item.contact]); await repo.saveDecision(item.decision)
  render(<MemoryRouter initialEntries={['/review?tab=work']}><ReviewScreen /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'View Short, Work' }))
  vi.stubGlobal('innerHeight', 400)
  act(() => window.dispatchEvent(new Event('resize')))
  expect(document.querySelectorAll('.scroll-fallback[data-constrained="true"]')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Done' }).closest('.sheet-footer')).toBeInTheDocument()
})
