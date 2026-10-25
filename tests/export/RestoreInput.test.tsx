import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestoreInput from '@/features/export/RestoreInput'
import { allContacts, allDecisions, getMeta, resetAll, upsertContacts } from '@/db/repo'
import { toast } from '@/ui/toast'
import { contact, row } from './fixtures'
vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))
const backup = JSON.stringify({ version: 1, exportedAt: '2026-10-12T12:00:00Z', contacts: [contact('new')], decisions: [row('new').decision] })
const choose = (text = backup) => fireEvent.change(screen.getByLabelText('Choose backup file'), { target: { files: [new File([text], 'backup.json')] } })
beforeEach(async () => { vi.clearAllMocks(); await resetAll(); await upsertContacts([contact('existing')]) })
afterEach(cleanup)

describe('RestoreInput (#1/#36)', () => {
  it('writes nothing until commit, previews both modes, then supports the Undo toast', async () => {
    render(<RestoreInput />)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    choose()
    expect(await screen.findByText('Backup from 12 Oct 2026 · 1 contacts · 1 decisions')).toBeVisible()
    expect(screen.getByText('+1 added · 0 changed · 1 removed')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review backup' })).toHaveFocus()
    expect((await allContacts()).map((c) => c.id)).toEqual(['existing'])
    expect(await allDecisions()).toEqual([])
    expect(await getMeta('restoreUndo', null)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Merge/ }))
    expect(screen.getByText('+1 added · 0 changed · 0 removed')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Merge backup' })).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: /Replace/ }))
    fireEvent.click(screen.getByRole('button', { name: "Replace this app's data" }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Restored ·', expect.objectContaining({ duration: 600000 })))
    expect((await allContacts()).map((c) => c.id)).toEqual(['new'])
    const options = vi.mocked(toast).mock.calls[0][1]
    options?.action?.onClick()
    await waitFor(async () => expect((await allContacts()).map((c) => c.id)).toEqual(['existing']))
  })

  it('cancels review without mutation', async () => {
    render(<RestoreInput />)
    choose()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
    expect((await allContacts()).map((c) => c.id)).toEqual(['existing'])
  })

  it('requires another review if live counts changed', async () => {
    render(<RestoreInput />)
    choose()
    const commit = await screen.findByRole('button', { name: "Replace this app's data" })
    await upsertContacts([contact('another')])
    fireEvent.click(commit)
    expect(await screen.findByRole('status')).toHaveTextContent('Review the updated counts')
    expect(await allContacts()).toHaveLength(2)
    expect(screen.getByText('+1 added · 0 changed · 2 removed')).toBeVisible()
  })

  it('handles malformed files with a local error and permits another selection', async () => {
    render(<RestoreInput />)
    choose('{')
    expect(await screen.findByRole('status')).toHaveTextContent('not valid JSON')
    choose()
    expect(await screen.findByRole('button', { name: "Replace this app's data" })).toBeVisible()
  })
})
