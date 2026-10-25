// Findings #56/#55/#41: ID-bound notices; persistent ten-minute recovery, short toast.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
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
  it('returns an Undo conflict to Settings after navigating away (#52)', async () => {
    render(<MemoryRouter initialEntries={['/settings']}><Routes>
      <Route path="/settings" element={<><Link to="/elsewhere">Leave settings</Link><details><summary>Restore</summary><RestoreInput /></details></>} />
      <Route path="/elsewhere" element={<p>Elsewhere</p>} />
    </Routes></MemoryRouter>)
    fireEvent.click(screen.getByText('Restore'))
    choose()
    fireEvent.click(await screen.findByRole('button', { name: "Replace this app's data" }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Restored from backup (12 Oct) ·', expect.objectContaining({ priority: 'high' })))
    const action = vi.mocked(toast).mock.calls[0][1]?.action
    fireEvent.click(screen.getByRole('link', { name: 'Leave settings' }))
    await upsertContacts([contact('later')])
    await act(async () => { action?.onClick() })
    expect(await screen.findByRole('button', { name: 'Roll back data' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review rollback' })).toHaveFocus()
    expect((await allContacts()).map((c) => c.id)).toEqual(['later', 'new'])
  })

  it('keeps recovery after remount and reviews newer work before rollback (#52)', async () => {
    const view = render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    choose()
    fireEvent.click(await screen.findByRole('button', { name: "Replace this app's data" }))
    await screen.findByRole('button', { name: 'Undo restore' })
    view.unmount()
    await upsertContacts([contact('later')])
    render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Undo restore' }))
    expect(await screen.findByText('Changes since the restore will be lost: +1 added · 0 changed · 2 removed')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review rollback' })).toHaveFocus()
    expect((await allContacts()).map((c) => c.id)).toEqual(['later', 'new'])
    fireEvent.click(screen.getByRole('button', { name: 'Keep current data' }))
    expect(screen.queryByRole('region', { name: 'Review rollback' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo restore' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Roll back data' }))
    await waitFor(async () => expect((await allContacts()).map((c) => c.id)).toEqual(['existing']))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo restore' }))
    await waitFor(async () => expect((await allContacts()).map((c) => c.id)).toEqual(['later', 'new']))
  })

  it('writes nothing until commit, previews both modes, then supports the Undo toast', async () => {
    render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    choose()
    expect(await screen.findByText('Backup from 12 Oct 2026 · 1 contacts · 1 decisions')).toBeVisible()
    expect(screen.getByText('+1 added · 0 changed · 1 removed')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review backup' })).toHaveFocus()
    expect((await allContacts()).map((c) => c.id)).toEqual(['existing'])
    expect(await allDecisions()).toEqual([])
    expect(await getMeta('restoreHistory', [])).toEqual([])
    fireEvent.click(screen.getByRole('radio', { name: /Merge/ }))
    expect(screen.getByText('+1 added · 0 changed · 0 removed')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Merge backup' })).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: /Replace/ }))
    fireEvent.click(screen.getByRole('button', { name: "Replace this app's data" }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Restored from backup (12 Oct) ·', expect.objectContaining({ duration: 4000 })))
    expect((await allContacts()).map((c) => c.id)).toEqual(['new'])
    const options = vi.mocked(toast).mock.calls[0][1]
    await act(async () => { options?.action?.onClick() })
    await waitFor(async () => expect((await allContacts()).map((c) => c.id)).toEqual(['existing']))
  })

  it('cancels review without mutation', async () => {
    render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    choose()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel restore' }))
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
    expect((await allContacts()).map((c) => c.id)).toEqual(['existing'])
  })

  it('requires another review if live counts changed', async () => {
    render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    choose()
    const commit = await screen.findByRole('button', { name: "Replace this app's data" })
    await act(async () => { await upsertContacts([contact('another')]) })
    fireEvent.click(commit)
    expect(await screen.findByRole('status')).toHaveTextContent('Review the updated counts')
    expect(await allContacts()).toHaveLength(2)
    expect(screen.getByText('+1 added · 0 changed · 2 removed')).toBeVisible()
  })

  it('handles malformed files with a local error and permits another selection', async () => {
    render(<MemoryRouter><RestoreInput /></MemoryRouter>)
    choose('{')
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON') // #34: local errors use InlineNotice.
    choose()
    expect(await screen.findByRole('button', { name: "Replace this app's data" })).toBeVisible()
  })
})

// #56: the first toast still reviews the first snapshot after a second restore.
it('binds older toast actions to their original recovery entry', async () => {
  render(<MemoryRouter><RestoreInput /></MemoryRouter>)
  choose()
  fireEvent.click(await screen.findByRole('button', { name: "Replace this app's data" }))
  await waitFor(() => expect(toast).toHaveBeenCalled())
  const olderAction = vi.mocked(toast).mock.calls[0][1]!.action!
  choose(backup.replaceAll('new', 'second'))
  fireEvent.click(await screen.findByRole('button', { name: "Replace this app's data" }))
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Undo restore' })).toHaveLength(2))
  await act(async () => { olderAction.onClick() })
  expect(await screen.findByText('Changes since the restore will be lost: +1 added · 0 changed · 1 removed')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Roll back data' }))
  await waitFor(async () => expect((await allContacts()).map(c => c.id)).toEqual(['existing']))
})
