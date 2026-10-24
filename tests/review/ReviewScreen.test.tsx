import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
afterEach(cleanup)

function open() {
  render(<MemoryRouter initialEntries={['/review']}><Routes>
    <Route path="/review" element={<ReviewScreen />} />
    <Route path="/deck/:pass" element={<p>Deck destination</p>} />
  </Routes></MemoryRouter>)
}
describe('Review screen', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Personal' }))
    await waitFor(async () => expect((await getDecision('ana')).bucket).toBe('personal'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument())
  })
  it('selects a row after a 500ms long press without opening its details', async () => {
    open()
    const button = await screen.findByRole('button', { name: 'View Ana' })
    // jsdom does not implement PointerEvent on every supported version.
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperties(down, { button: { value: 0 }, clientX: { value: 10 }, clientY: { value: 10 } })
    fireEvent(button, down)
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select Ana' })).toBeChecked())
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
