import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import { row } from '../export/fixtures'
import ReviewScreen from '@/features/review/ReviewScreen'
import RowSheet from '@/features/review/RowSheet'
import { dismissToast, Toaster } from '@/ui/toast'

beforeEach(repo.resetAll)
afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function seed(rows: ReturnType<typeof row>[]) {
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
}
function open(tab = 'work') { render(<MemoryRouter initialEntries={['/review?tab=' + tab]}><ReviewScreen /><Toaster /></MemoryRouter>) }

describe('Review audit regressions', () => {
  it.each(['work', 'personal', 'delete', undefined] as const)('#20: the visible menu exposes every other destination for %s', async bucket => {
    await seed([row('Maria', { bucket, workStatus: bucket === 'work' ? 'current' : undefined })])
    open(bucket ?? 'unsorted')
    const more = await screen.findByRole('button', { name: 'More actions for Maria' })
    expect(more).toHaveStyle({ width: '44px', height: '44px' })
    fireEvent.click(more)
    const dialog = within(screen.getByRole('dialog'))
    for (const value of ['work', 'personal', 'delete']) {
      const label = 'Move to ' + value.charAt(0).toUpperCase() + value.slice(1)
      expect(!!dialog.queryByRole('button', { name: label })).toBe(value !== bucket)
    }
    expect(!!dialog.queryByRole('button', { name: 'Unsort' })).toBe(!!bucket)
  })
  it('#21/#30: search scope and textual classification are visible', async () => {
    await seed([row('Maria', { bucket: 'work', workStatus: 'current' }), row('Bo', { bucket: 'work' })])
    open()
    expect(await screen.findByPlaceholderText('Search in Work (2)')).toBeInTheDocument()
    expect(screen.getByText('Work · Current')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Maria, Work, Current' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Maria' } })
    expect(screen.getByText('1 of 2 match')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Personal/ }))
    expect(screen.getByPlaceholderText('Search in Personal (0)')).toBeInTheDocument()
  })
  it('#22: bulk moves only filtered selections, keeps the bar, and atomically undoes the full decisions', async () => {
    const rows = [row('A', { bucket: 'work', workStatus: 'current', customTags: ['vip'] }),
      row('B', { bucket: 'work', workStatus: 'old' }), row('C', { bucket: 'personal', relation: 'family' })]
    await seed(rows); open()
    await screen.findByRole('button', { name: 'View A, Work, Current, vip' })
    fireEvent.click(screen.getByRole('radio', { name: 'Current' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all 1 results' }))
    expect(screen.getByText('1 of 2 selected in Work')).toBeInTheDocument()
    const save = vi.spyOn(repo, 'saveDecisions')
    fireEvent.click(screen.getByRole('button', { name: 'Move to…' }))
    // #14/#34: choose a destination, then commit from the fixed footer.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Personal' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('1 moved to Personal ·')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 selected in Work')).toBeInTheDocument()
    expect(await repo.getDecision('B')).toEqual(rows[1].decision)
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }))
    await waitFor(async () => expect(await repo.getDecision('A')).toEqual(rows[0].decision))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1][0]).toEqual([rows[0].decision])
    fireEvent.click(screen.getByRole('tab', { name: /^Personal/ }))
    expect(screen.queryByRole('button', { name: 'Move to…' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Work/ }))
    expect(screen.queryByRole('button', { name: 'Move to…' })).not.toBeInTheDocument()
  })
  it('#23: classification precedes visible values and advanced fields and Other completes Personal', async () => {
    const contact = row('Maria', { bucket: 'personal' })
    contact.contact.rev = '2023-04-10T12:00:00Z'
    contact.contact.phones = [{ value: '555-1234', type: 'CELL' }]
    contact.contact.source = 'vcf'
    await seed([contact])
    render(<MemoryRouter><RowSheet row={contact} onClose={vi.fn()} /></MemoryRouter>)
    const classification = screen.getByRole('region', { name: 'Classification' })
    const details = screen.getByText('All fields').closest('details')!
    expect(classification.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Other' }))
    await waitFor(async () => expect((await repo.getDecision('Maria')).relation).toBe('other'))
    fireEvent.click(screen.getByText('All fields'))
    expect(screen.getByRole('button', { name: 'Copy 555-1234' })).toBeInTheDocument()
    expect(screen.getByText('Phone · Mobile')).toBeInTheDocument()
    expect(screen.getByText('vCard file')).toBeInTheDocument()
    expect(screen.queryByText(contact.contact.rev)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' }).closest('.sheet-footer')).toBeInTheDocument()
  })
  it('#40: uses an inline pane at 1024px and a modal at 1023px', async () => {
    let width = 1024
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ get matches() { return query === '(min-width: 1024px)' && width >= 1024 },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })))
    await seed([row('Maria', { bucket: 'work' })]); open()
    fireEvent.click(await screen.findByRole('button', { name: 'View Maria, Work' }))
    expect(screen.getByRole('complementary', { name: 'Selected contact' })).toHaveTextContent('Maria')
    expect(screen.getByRole('region', { name: 'Contact details' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => { width = 1023; listeners.forEach(listener => listener()) })
    expect(screen.getByRole('dialog', { name: 'Contact details' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
  it('#24: database-read errors offer an in-place retry', async () => {
    vi.spyOn(repo, 'allWithDecisions').mockRejectedValueOnce(new Error('Unavailable'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load contacts')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
  })
})
