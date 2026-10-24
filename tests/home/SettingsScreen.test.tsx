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
  it('replays the coach by clearing only ct.coach. keys', async () => {
    window.localStorage.setItem('ct.coach.triage', 'seen')
    window.localStorage.setItem('ct.coach.work', 'seen')
    window.localStorage.setItem('ct.coach.personal', 'seen')
    window.localStorage.setItem('ct.theme', 'dark')
    window.localStorage.setItem('ct.coach', 'unrelated')
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Replay gesture coach' }))
    expect(window.localStorage.getItem('ct.coach.triage')).toBeNull()
    expect(window.localStorage.getItem('ct.coach.work')).toBeNull()
    expect(window.localStorage.getItem('ct.coach.personal')).toBeNull()
    expect(window.localStorage.getItem('ct.theme')).toBe('dark')
    expect(window.localStorage.getItem('ct.coach')).toBe('unrelated')
    expect(await screen.findByText('Coach will show on the next deck')).toBeInTheDocument()
    expect(screen.getByText('Danger zone')).toBeInTheDocument()
  })
  it('records and displays the date only after exporting a backup', async () => {
    open()
    expect(await screen.findByText('No backup exported yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back up (.json)' }))
    await waitFor(() => expect(downloadText).toHaveBeenCalledWith('contacts-backup.json', expect.any(String), 'application/json'))
    await waitFor(async () => expect(await getMeta('lastBackupAt', null)).toEqual(expect.any(String)))
    expect(await screen.findByText(/^Last backup:/)).toHaveTextContent(new Date().toLocaleDateString())
  })
  it('explains restore modes and confirms the counts erased by reset', async () => {
    const rows = [row('A', { bucket: 'work', customTags: ['vip'] }), row('B')]
    await upsertContacts(rows.map(({ contact }) => contact))
    await saveDecisions([rows[0].decision])
    open()
    expect(screen.getByText('Replace makes this device match the backup exactly; Merge keeps what is already here.')).toBeInTheDocument()
    expect(await screen.findByText('Reset will erase 2 contacts, 1 sorting decision, and 1 tag, plus app session metadata.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Will erase 2 contacts, 1 sorting decision, and 1 tag')
    expect(await allContacts()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await allContacts()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, reset all data' }))
    await waitFor(async () => expect(await allContacts()).toHaveLength(0))
  })
})
