import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import * as notices from '@/ui/toast'
import { formatDate, formatPhone } from '@/ui'
import RowSheet from '@/features/review/RowSheet'
import ReviewRow from '@/features/review/ReviewRow'
import ReviewScreen from '@/features/review/ReviewScreen'
import BulkBar from '@/features/review/BulkBar'
import { readRawFields } from '@/import/rawFields'
import { row } from '../export/fixtures'

beforeEach(async () => { await repo.resetAll(); window.sessionStorage.clear() })
afterEach(() => { cleanup(); notices.dismissToast(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('#23/#46/#39: compact identity precedes classification; all preserved fields and original records are available', async () => {
  const item = row('Maria', { bucket: 'personal' })
  item.contact.phones = [{ value: '+12025550101;ext=42', type: 'CELL' }]
  item.contact.emails = [{ value: 'maria@example.com' }]
  item.contact.raw = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Maria\r\nBDAY:19900412\r\nADR:;;12 Main\\; Apt 2;Town;;123;US\r\nURL:https://example.com/profile\r\nX-MERGED-CUSTOM:Long\r\n value\r\nEND:VCARD'
  const copy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  render(<MemoryRouter><RowSheet row={item} onClose={vi.fn()} /></MemoryRouter>)
  const phone = screen.getByRole('link', { name: formatPhone(item.contact.phones[0].value) })
  expect(phone.closest('details')).toBeNull()
  expect(phone).toHaveAttribute('href', 'tel:+12025550101;ext=42')
  expect(phone.compareDocumentPosition(screen.getByRole('region', { name: 'Classification' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copy maria@example.com' }))
  expect(await screen.findByText('Copied')).toBeInTheDocument()
  expect(copy).toHaveBeenCalledWith('maria@example.com')
  const disclosure = screen.getByText('All fields').closest('details')!
  expect(disclosure).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('All fields'))
  expect(screen.getByText(formatDate('19900412'))).toBeVisible()
  expect(screen.getByText('12 Main; Apt 2, Town, 123, US')).toBeVisible()
  expect(screen.getByRole('link', { name: 'https://example.com/profile' })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByText('Longvalue')).toBeVisible()
  fireEvent.click(screen.getByText('Original contact record 1'))
  expect(disclosure.querySelector('pre')).toHaveTextContent('X-MERGED-CUSTOM:Long')
})

it('#46: unsafe websites stay text, and repeated/grouped properties survive', () => {
  expect(readRawFields({ ...row('Raw').contact, raw: 'item1.URL:javascript:alert(1)\nBDAY:invalid\nX-FIELD:first\nX-FIELD:second' })).toEqual([
    { label: 'Website', value: 'javascript:alert(1)', kind: 'url' },
    { label: 'Birthday', value: 'invalid', kind: 'date' },
    { label: 'X-FIELD', value: 'first', kind: 'text' }, { label: 'X-FIELD', value: 'second', kind: 'text' },
  ])
})

it('#7: choosing only a Personal type persists Other and keeps it when the type is removed', async () => {
  const item = row('Maria', { bucket: 'personal' })
  await repo.upsertContacts([item.contact])
  render(<MemoryRouter><RowSheet row={item} onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Neighbor' }))
  await waitFor(async () => expect(await repo.getDecision('Maria')).toMatchObject({ relation: 'other', personalTypes: ['neighbor'] }))
  expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Neighbor' }))
  await waitFor(async () => expect(await repo.getDecision('Maria')).toMatchObject({ relation: 'other', personalTypes: [] }))
})

it('#53/#30: legacy type-only rows show only saved state and a two-item visible summary with overflow count', () => {
  render(<ul><ReviewRow row={row('Maria', { bucket: 'personal', personalTypes: ['neighbor', 'service'], customTags: ['vip', 'school'] })}
    selecting={false} selected={false} onOpen={vi.fn()} onToggle={vi.fn()} onLongPress={vi.fn()} /></ul>)
  expect(screen.getByText('Personal')).toBeVisible()
  expect(screen.queryByText('Personal · Other')).not.toBeInTheDocument()
  expect(screen.getByText('Neighbor')).toBeVisible()
  expect(screen.getByText('Service provider')).toBeVisible()
  expect(screen.getByText('+2')).toBeVisible()
  expect(screen.queryByText('vip')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View Maria, Personal, Neighbor, Service provider, vip, school' })).toBeInTheDocument()
})

it.each(['Move to…', 'Tag…'])('#14/#34: %s stages changes and uses Cancel / Apply outside the scroller', async action => {
  const item = row('Maria', { bucket: 'work' })
  await repo.upsertContacts([item.contact]); await repo.saveDecision(item.decision)
  render(<BulkBar rows={[item]} onClear={vi.fn()} onSelectAll={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: action }))
  const dialog = within(screen.getByRole('dialog'))
  if (action === 'Move to…') fireEvent.click(dialog.getByRole('radio', { name: 'Personal' }))
  else fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'vip' } })
  expect(await repo.getDecision('Maria')).toEqual(item.decision)
  for (const name of ['Cancel', 'Apply']) expect(dialog.getByRole('button', { name }).closest('.sheet-footer')).toBeInTheDocument()
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }))
  await waitFor(async () => expect(await repo.getDecision('Maria')).toMatchObject(action === 'Move to…' ? { bucket: 'personal' } : { customTags: ['vip'] }))
})

it('#5/#34: single-row move requests ten seconds of high-priority Undo', async () => {
  const item = row('Maria', { bucket: 'work', workStatus: 'current' })
  await repo.upsertContacts([item.contact]); await repo.saveDecision(item.decision)
  const toast = vi.spyOn(notices, 'toast')
  render(<ul><ReviewRow row={item} selecting={false} selected={false} onOpen={vi.fn()} onToggle={vi.fn()} onLongPress={vi.fn()} /></ul>)
  fireEvent.keyDown(screen.getByRole('button', { name: /^View/ }), { key: 'ArrowLeft' })
  fireEvent.click(screen.getByRole('button', { name: 'Move Maria to Personal' }))
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Maria → Personal', expect.objectContaining({ duration: 10000, priority: 'high' })))
  act(() => { toast.mock.calls.at(-1)![1]!.action!.onClick() })
  await waitFor(async () => expect(await repo.getDecision('Maria')).toEqual(item.decision))
})

it('#54/#35: persisted pairs appear above an unfiltered list and the panel can be hidden', async () => {
  await repo.upsertContacts(['A', 'B', 'C'].map(id => row(id).contact))
  await repo.setMeta('possibleDuplicates', [{ ids: ['A', 'B', 'missing'], reason: 'Shared phone' }])
  render(<MemoryRouter initialEntries={['/review?tab=unsorted&dupes=1']}><ReviewScreen /></MemoryRouter>)
  expect(await screen.findByRole('region', { name: 'Possible duplicates' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Possible duplicates' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('button', { name: /^View/ })).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Possible duplicates' }))
  expect(screen.getAllByRole('button', { name: /^View/ })).toHaveLength(3)
})
