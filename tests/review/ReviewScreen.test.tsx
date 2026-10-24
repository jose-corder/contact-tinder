import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { getDecision, resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import ReviewScreen from '@/features/review/ReviewScreen'
import { row } from '../export/fixtures'

const seeded = [
  row('ana', { bucket: 'delete' }),
  row('bo', { bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['vip'] }),
  row('cy', { bucket: 'personal', relation: 'friend', personalTypes: ['neighbor'] }),
]
beforeEach(async () => {
  await resetAll()
  await upsertContacts(seeded.map((r, i) => ({ ...r.contact, displayName: ['Ana', 'Bo', 'Cy'][i], org: ['Archive', 'Studio', 'Home'][i],
    phones: [{ value: `555-000${i}` }], emails: [{ value: `${r.contact.id}@example.com` }] })))
  await saveDecisions(seeded.map((r) => r.decision))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

function open(path = '/review') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/review" element={<ReviewScreen />} />
    <Route path="/deck/:pass" element={<p>Deck destination</p>} />
  </Routes></MemoryRouter>)
}
describe('Review screen', () => {
  it('preselects the URL tab and clears status, type, tag, and search filters together', async () => {
    open('/review?tab=work')
    await screen.findByText('Bo')
    expect(screen.getByRole('tab', { name: /^Work/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Current' }))
    fireEvent.click(screen.getByRole('button', { name: 'Client' }))
    fireEvent.click(screen.getByRole('button', { name: 'vip' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'absent' } })
    expect(screen.getByText('0 contacts')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Client' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1 contact')).toBeInTheDocument()
    expect(screen.getByText('Bo')).toBeInTheDocument()
  })
  it('selects all filtered contacts and adds a normalized tag without removing an existing one', async () => {
    await upsertContacts([row('bea').contact])
    await saveDecisions([row('bea', { bucket: 'work' }).decision])
    open('/review?tab=work')
    await screen.findByText('Bo')
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all in view' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tag…' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Tag selected contacts' }), { target: { value: ' VIP ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    await waitFor(async () => {
      expect((await getDecision('bo')).customTags).toEqual(['vip'])
      expect((await getDecision('bea')).customTags).toEqual(['vip'])
      expect((await getDecision('ana')).customTags).toEqual([])
    })
  })
  it('returns just the open contact to its deck without changing its neighbors', async () => {
    await upsertContacts([row('bea').contact])
    await saveDecisions([row('bea', { bucket: 'work', workStatus: 'old' }).decision])
    open('/review?tab=work')
    fireEvent.click(await screen.findByRole('button', { name: 'View Bo' }))
    // Finding #27: dial separators are normalized and email addresses encoded.
    expect(screen.getByRole('link', { name: '555-0001' })).toHaveAttribute('href', 'tel:5550001')
    expect(screen.getByRole('link', { name: 'bo@example.com' })).toHaveAttribute('href', 'mailto:bo%40example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Jump to deck' }))
    await screen.findByText('Deck destination')
    expect((await getDecision('bo')).workStatus).toBeUndefined()
    expect((await getDecision('bea')).workStatus).toBe('old')
  })
  it('switches bucket tabs and filters names, company, phone and email', async () => {
    open()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Work/ }))
    expect(await screen.findByText('Bo')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    const search = screen.getByRole('searchbox')
    for (const query of ['BO', 'STUDIO', '555-0001', 'BO@EXAMPLE.COM']) {
      fireEvent.change(search, { target: { value: query } })
      expect(screen.getByText('Bo')).toBeInTheDocument()
    }
    fireEvent.change(search, { target: { value: 'absent' } })
    expect(screen.queryByText('Bo')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(screen.getByRole('tab', { name: /^Personal/ }))
    expect(screen.getByText('Cy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Unsorted/ }))
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })
  it('filters work status, types, and tags', async () => {
    open()
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('tab', { name: /^Work/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Old' }))
    expect(screen.queryByText('Bo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Current' }))
    fireEvent.click(screen.getByRole('button', { name: 'Client' }))
    fireEvent.click(screen.getByRole('button', { name: 'vip' }))
    expect(screen.getByText('Bo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vendor' }))
    expect(screen.queryByText('Bo')).not.toBeInTheDocument()
  })
  it('saves row edits immediately and confirms removal inline', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'View Ana' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('button', { name: 'Work' }))
    await waitFor(async () => expect((await getDecision('ana')).bucket).toBe('work'))
    fireEvent.click(await dialog.findByRole('button', { name: 'Current' }))
    await waitFor(async () => expect((await getDecision('ana')).workStatus).toBe('current'))
    fireEvent.change(dialog.getByRole('textbox', { name: 'New custom tag' }), { target: { value: 'VIP' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Add' }))
    await waitFor(async () => expect((await getDecision('ana')).customTags).toEqual(['vip']))
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Remove from app' })).toBeEnabled())
    fireEvent.click(dialog.getByRole('button', { name: 'Remove from app' }))
    expect(dialog.getByRole('button', { name: 'Confirm removal' })).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel removal' }))
    expect(dialog.queryByRole('button', { name: 'Confirm removal' })).not.toBeInTheDocument()
  })
  it('bulk moves selected contacts and clears selection', async () => {
    open()
    await screen.findByText('Ana')
    expect(screen.getByRole('button', { name: 'Select' })).toHaveClass('min-h-11', 'min-w-11')
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11', 'min-w-11')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Personal' }))
    await waitFor(async () => expect((await getDecision('ana')).bucket).toBe('personal'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument())
  })
  it('review_longpress_uses_fake_time', async () => {
    open()
    const button = await screen.findByRole('button', { name: 'View Ana' })
    vi.useFakeTimers()
    // Finding #31: release before the threshold must cancel selection.
    // jsdom does not implement PointerEvent on every supported version.
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperties(down, { button: { value: 0 }, clientX: { value: 10 }, clientY: { value: 10 } })
    fireEvent(button, down)
    act(() => vi.advanceTimersByTime(499))
    fireEvent.pointerUp(button)
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent(button, down)
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('checkbox', { name: 'Select Ana' })).toBeChecked()
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Ana' })).toBeChecked()
  })
  it('re-swipes only the filtered contacts and navigates to their pass', async () => {
    open()
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('tab', { name: /^Work/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Re-swipe these' }))
    expect(await screen.findByText('Deck destination')).toBeInTheDocument()
    expect((await getDecision('bo')).workStatus).toBeUndefined()
    expect((await getDecision('bo')).skips.work).toBe(0)
    expect((await getDecision('ana')).bucket).toBe('delete')
  })
})
