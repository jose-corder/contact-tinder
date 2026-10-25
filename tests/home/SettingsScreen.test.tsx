import { formatDate } from '@/ui'
// Audit #41: literal backup/reset labels and honest recovery retention.
// Audit #36: concise Data section and disclosed shared restore flow.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { allContacts, getMeta, resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import { row } from '../export/fixtures'
import SettingsScreen from '@/features/home/SettingsScreen'
import { dismissToast, Toaster } from '@/ui/toast'
import { downloadText } from '@/export/share'

vi.mock('@/export/share', () => ({ downloadText: vi.fn() }))
beforeEach(async () => { await resetAll(); window.localStorage.clear(); vi.clearAllMocks() })
afterEach(() => { cleanup(); dismissToast() })
function open() { render(<MemoryRouter><SettingsScreen /><Toaster /></MemoryRouter>) }

describe('Settings', () => {
  it('#31: appearance is a named radio group with arrow-key selection', () => {
    open()
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument()
    const system = screen.getByRole('radio', { name: 'System' })
    system.focus()
    fireEvent.keyDown(system, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
    expect(window.localStorage.getItem('ct.theme')).toBe('light')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
  it('replays the coach by clearing only ct.coach. keys', async () => {
    window.localStorage.setItem('ct.coach.triage', 'seen')
    window.localStorage.setItem('ct.coach.work', 'seen')
    window.localStorage.setItem('ct.coach.personal', 'seen')
    window.localStorage.setItem('ct.theme', 'dark')
    window.localStorage.setItem('ct.coach', 'unrelated')
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Show tips next time' }))
    expect(window.localStorage.getItem('ct.coach.triage')).toBeNull()
    expect(window.localStorage.getItem('ct.coach.work')).toBeNull()
    expect(window.localStorage.getItem('ct.coach.personal')).toBeNull()
    expect(window.localStorage.getItem('ct.theme')).toBe('dark')
    expect(window.localStorage.getItem('ct.coach')).toBe('unrelated')
    expect(await screen.findByText('Tips will show next time you sort')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reset app' })).toBeInTheDocument()
  })
  it('records and displays the date only after exporting a backup', async () => {
    open()
    expect(await screen.findByText('No backup exported yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back up app data' }))
    await waitFor(() => expect(downloadText).toHaveBeenCalledWith('contacts-backup.json', expect.any(String), 'application/json'))
    await waitFor(async () => expect(await getMeta('lastBackupAt', null)).toEqual(expect.any(String)))
    expect(await screen.findByText(/^Last backup:/)).toHaveTextContent(formatDate(new Date()))
  })
  it('explains restore modes and confirms the counts erased by reset', async () => {
    const rows = [row('A', { bucket: 'work', customTags: ['vip'] }), row('B')]
    await upsertContacts(rows.map(({ contact }) => contact))
    await saveDecisions([rows[0].decision])
    open()
    // #26/#36: restore is hosted directly in Settings.
    // #41: recovery is promised only when an available recovery entry exists.
    expect(screen.getByText("Restore replaces or merges this device's data.")).toBeInTheDocument()
    expect(screen.queryByText('Undo available for 10 minutes; all unexpired restores are kept')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Choose backup file').closest('details')).toBeNull()
    expect(screen.getByLabelText('Choose backup file')).toBeInTheDocument()
    expect(await screen.findByText('Reset will erase 2 contacts, 1 sorting decision, and 1 tag, and saved progress.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset app' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Will erase 2 contacts, 1 sorting decision, and 1 tag')
    expect(await allContacts()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await allContacts()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Reset app' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, reset app' }))
    await waitFor(async () => expect(await allContacts()).toHaveLength(0))
  })
})
