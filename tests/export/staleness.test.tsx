// Finding #41: prepare and download buttons name their object.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { db } from '@/db/schema'
import { allWithDecisions, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import ExportAction from '@/features/export/ExportAction'
import ExportScreen from '@/features/export/ExportScreen'
import { row } from './fixtures'

beforeEach(async () => {
  await resetAll()
  await upsertContacts([row('Ada').contact])
  vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn(), userActivation: { isActive: false } })
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:download'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('prepared exports (#48/#25/#26)', () => {
  it('invalidates a ready share after a classification changes and regenerates current contents', async () => {
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Share clean address book' }))
    await screen.findByRole('button', { name: 'Share ready file' })
    await act(async () => { await saveDecision(row('Ada', { bucket: 'personal', relation: 'other', updatedAt: 10 }).decision) })
    expect(await screen.findByText('Contacts changed — prepare again')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Share ready file' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare clean address book' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Share ready file' }))
    await waitFor(() => expect(navigator.share).toHaveBeenCalledOnce())
    const file = vi.mocked(navigator.share).mock.calls[0][0]!.files![0]
    const contents = await new Promise<string>((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file)
    })
    expect(contents).toContain('CATEGORIES:Personal,Other')
  })

  it('invalidates Download prepared file after a later import', async () => {
    vi.mocked(navigator.share).mockRejectedValue(new Error('No sharing'))
    Object.defineProperty(navigator, 'userActivation', { value: { isActive: true }, configurable: true })
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Share clean address book' }))
    await screen.findByRole('button', { name: 'Download prepared file' })
    await act(async () => { await upsertContacts([row('New').contact]) })
    await screen.findByRole('button', { name: 'Prepare clean address book' })
    expect(screen.queryByRole('button', { name: 'Download prepared file' })).not.toBeInTheDocument()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('discards files if the database changes during preparation', async () => {
    let finish!: (files: File[]) => void
    const prepare = vi.fn(() => new Promise<File[]>((resolve) => { finish = resolve }))
    render(<ExportAction label="contacts" stubs={[new File([], 'test.vcf')]} prepare={prepare} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share contacts' }))
    await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
    await act(async () => {
      await db.contacts.update('Ada', { displayName: 'Updated' })
      finish([new File(['old'], 'test.vcf')])
    })
    expect(await screen.findByRole('button', { name: 'Prepare contacts' })).toBeEnabled()
    expect(navigator.share).not.toHaveBeenCalled()
  })

  it('presents Settings ownership and prepares CSV before downloading', async () => {
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Clean address book' })
    fireEvent.click(screen.getByText('More exports'))
    expect(screen.getByRole('link', { name: /Back up or restore/ })).toHaveAttribute('href', '/settings')
    expect(screen.queryByLabelText('Choose backup file')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /app backup/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare CSV' }))
    const download = await screen.findByRole('button', { name: 'Download CSV' })
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    expect(within(download.parentElement!).getByRole('status')).toHaveTextContent('Ready to download')
    fireEvent.click(download)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
    expect(await allWithDecisions()).toHaveLength(1)
  })
})
