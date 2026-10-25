// Finding #25: multi-file export shares/downloads one ZIP.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as vcf from '@/export/vcf'
import * as repo from '@/db/repo'
import ExportScreen from '@/features/export/ExportScreen'
import ExportAction from '@/features/export/ExportAction'
import { row } from './fixtures'

const rows = [row('Work', { bucket: 'work', workStatus: 'current' }), row('Family', { bucket: 'personal', relation: 'family', customTags: ['lisbon'] }), row('Delete', { bucket: 'delete' })]
const show = () => render(<MemoryRouter><ExportScreen /></MemoryRouter>)
const more = () => fireEvent.click(screen.getByText('More exports'))

beforeEach(async () => {
  await repo.resetAll()
  await repo.upsertContacts(rows.map((r) => r.contact))
  await repo.saveDecisions(rows.map((r) => r.decision))
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:download'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Export screen', () => {
  // Findings #25/#34: failed sharing offers an explicit local fallback, without surprise downloads.
  it('prepares only the selected file and offers Download prepared file after share failure', async () => {
    const build = vi.spyOn(vcf, 'vcfText')
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Unavailable', 'NotAllowedError')) })
    show()
    const button = await screen.findByRole('button', { name: 'Share clean address book' })
    expect(build).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-busy', 'true')
    const fallback = await screen.findByRole('button', { name: 'Download prepared file' })
    expect(build).toHaveBeenCalledOnce()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    expect(within(fallback.parentElement!).getByRole('status')).toHaveTextContent('Could not share')
    fireEvent.click(fallback)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
  })

  it('guides the finish and collapses overlapping lists and restore', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true, share })
    show()
    await screen.findByRole('button', { name: 'Share clean address book' })
    expect(screen.getByText("Delete marks a list. Your phone's contacts are unchanged until you act on it.")).toBeVisible()
    expect(screen.getByText(/Share → Save to Files/)).toBeVisible()
    expect(screen.getByText(/Importing adds entries and can duplicate/)).toBeVisible()
    expect(screen.getByText('Work · Current')).not.toBeVisible()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    more()
    fireEvent.click(screen.getByRole('button', { name: 'Share work-current.vcf' }))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(share.mock.calls[0][0].files[0].name).toBe('work-current.vcf')
    fireEvent.click(screen.getByRole('button', { name: 'Share contacts-export.zip' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
    expect(share.mock.calls[1][0].files).toHaveLength(1)
    expect(share.mock.calls[1][0].files[0].name).toBe('contacts-export.zip')
  })

  it('shows Download without sharing support and warns about multiple downloads before starting', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Android', maxTouchPoints: 5 })
    show()
    await screen.findByRole('button', { name: 'Download clean address book' })
    more()
    // #25: all selected files are delivered in one archive.
    const button = screen.getByRole('button', { name: 'Download contacts-export.zip' })
    expect(within(button.parentElement!).getByText(/All files are included/)).toBeVisible()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
  })

  it('keeps per-file Share when only multi-file sharing is unavailable', async () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, share: vi.fn(), canShare: ({ files }: ShareData) => files?.length === 1 })
    show()
    await screen.findByRole('button', { name: 'Share clean address book' })
    more()
    expect(screen.getByRole('button', { name: 'Share work.vcf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share contacts-export.zip' })).toBeInTheDocument() // #25: share one archive.
  })

  it('treats native cancellation calmly and never starts a download', async () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) })
    show()
    const button = await screen.findByRole('button', { name: 'Share clean address book' })
    fireEvent.click(button)
    await waitFor(() => expect(within(button.parentElement!).getByRole('status')).toHaveTextContent('Sharing cancelled. Your files are still here.'))
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('offers a fresh sharing gesture after long preparation loses activation', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { userAgent: 'iPhone', canShare: () => true, share, userActivation: { isActive: false } })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Share clean address book' }))
    const ready = await screen.findByRole('button', { name: 'Share ready file' })
    expect(share).not.toHaveBeenCalled()
    fireEvent.click(ready)
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
  })

  it('asks before downloading when actual payloads cannot be shared', async () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: ({ files }: ShareData) => files?.every((file) => file.size === 0) })
    const stubs = [new File([], 'a.txt'), new File([], 'b.txt'), new File([], 'c.txt')]
    render(<ExportAction label="three files" stubs={stubs} prepare={async () => stubs.map((file) => new File(['data'], file.name))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share contacts-export.zip' }))
    const download = await screen.findByRole('button', { name: 'Download prepared file' }) // #25
    expect(screen.getByText('All files are included in contacts-export.zip.')).toBeVisible()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    fireEvent.click(download)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
  })

  it('shows a loading skeleton, then an empty import action', async () => {
    await repo.resetAll()
    show()
    expect(screen.getByRole('region', { name: 'Loading exports' })).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('No contacts yet.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Import contacts' })).toHaveClass('min-h-11')
  })

  it('recovers from a database read failure in place', async () => {
    vi.spyOn(repo, 'allWithDecisions').mockRejectedValueOnce(new Error('Read failed'))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Reload contacts' }))
    expect(await screen.findByRole('heading', { name: 'Clean address book' })).toBeVisible()
  })

  it('retries preparation errors beside the pressed button', async () => {
    const prepare = vi.fn().mockRejectedValueOnce(new Error('Failed')).mockResolvedValue([new File(['ok'], 'test.txt')])
    vi.stubGlobal('navigator', {})
    render(<ExportAction label="test" stubs={[new File([], 'test.txt')]} prepare={prepare} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download test' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not export')) // #34: errors use InlineNotice.
    fireEvent.click(screen.getByRole('button', { name: 'Download test' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download started.'))
  })
})
