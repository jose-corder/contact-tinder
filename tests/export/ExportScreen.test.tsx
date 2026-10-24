import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as vcf from '@/export/vcf'
import { toast } from '@/ui/toast'
import ExportScreen from '@/features/export/ExportScreen'
import { row } from './fixtures'

const rows = [row('Work', { bucket: 'work', workStatus: 'current' }), row('Family', { bucket: 'personal', relation: 'family', customTags: ['lisbon'] }), row('Delete', { bucket: 'delete' })]
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => rows }))
vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))
const show = () => render(<MemoryRouter><ExportScreen /></MemoryRouter>)

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:download'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Export screen', () => {
  it('export_preparation_is_bounded_and_share_failure_offers_download', async () => {
    const build = vi.spyOn(vcf, 'vcfText')
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Unavailable', 'NotAllowedError')) })
    show()
    expect(build).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Share clean address book' }))
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
    expect(build).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith('Sharing failed, downloaded instead')
  })

  it('shares individual files, all files and the clean preset on a capable phone', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true, share })
    show()
    expect(screen.getByText('Work · Current')).toBeInTheDocument()
    expect(screen.getByText('Personal · Family')).toBeInTheDocument()
    expect(screen.getByText('Tagged lisbon')).toBeInTheDocument()
    expect(screen.getByText(/Share → save to Files/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Share work-current.vcf' }))
    // Finding #25: requested files are prepared asynchronously after the tap.
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share.mock.calls[0][0].files[0].name).toBe('work-current.vcf')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share all vCards' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Share all vCards' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
    expect(share.mock.calls[1][0].files.length).toBeGreaterThan(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share clean address book' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Share clean address book' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(3))
    expect(share.mock.calls[2][0].files[0].name).toBe('contacts-clean.vcf')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share clean address book' })).toBeEnabled())
  })

  it('shows Download for every vCard action when file sharing is unavailable', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Android', maxTouchPoints: 5 })
    show()
    expect(screen.getByText(/Download → open the file/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download all vCards' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download clean address book' }))
    // Finding #25: lazy preparation completes before download.
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download clean address book' })).toBeEnabled())
  })

  it('keeps per-file Share when only multi-file sharing is unavailable', () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, share: vi.fn(), canShare: ({ files }: ShareData) => files?.length === 1 })
    show()
    expect(screen.getByRole('button', { name: 'Share work.vcf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download all vCards' })).toBeInTheDocument()
  })

  it('treats native cancellation calmly and never starts a download', async () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5, canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Share clean address book' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Sharing cancelled. Your files are still here.')
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })
})
