import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { resetAll, upsertContacts } from '@/db/repo'
import ExportScreen from '@/features/export/ExportScreen'
import ExportAction from '@/features/export/ExportAction'
import { XLSX_TYPE } from '@/export/xlsx'
import { row } from './fixtures'

beforeEach(async () => {
  await resetAll()
  vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) })
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:download'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('spreadsheet actions', () => {
  it('handles AbortError objects from other realms as cancellation and allows retry', async () => {
    vi.mocked(navigator.share).mockRejectedValueOnce({ name: 'AbortError' })
    const prepare = vi.fn().mockResolvedValue([new File(['xlsx'], 'contacts.xlsx', { type: XLSX_TYPE })])
    render(<ExportAction label="Excel spreadsheet" prepareFirst prepare={prepare} stubs={[new File([], 'contacts.xlsx', { type: XLSX_TYPE })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Prepare Excel spreadsheet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Share ready file' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sharing cancelled'))
    fireEvent.click(screen.getByRole('button', { name: 'Share ready file' }))
    await waitFor(() => expect(navigator.share).toHaveBeenCalledTimes(2))
    expect(prepare).toHaveBeenCalledOnce()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })
  it('invalidates prepared Excel when contact contents change', async () => {
    await upsertContacts([row('Ada').contact])
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    const section = (await screen.findByRole('heading', { name: 'Spreadsheet' })).closest('section')!
    fireEvent.click(within(section).getByRole('button', { name: 'Prepare Excel spreadsheet' }))
    await within(section).findByRole('button', { name: 'Share ready file' })
    await act(async () => { await upsertContacts([{ ...row('Ada').contact, notes: 'Changed after preparation' }]) })
    await within(section).findByRole('button', { name: 'Prepare Excel spreadsheet' })
    expect(within(section).getByRole('status')).toHaveTextContent('Contacts changed')
    expect(navigator.share).not.toHaveBeenCalled()
  })
  it('offers download when the real workbook cannot be shared', async () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: ({ files }: ShareData) => files?.[0]?.size === 0 })
    await upsertContacts([row('Ada').contact])
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare Excel spreadsheet' }))
    const button = await screen.findByRole('button', { name: 'Download prepared file' })
    expect(within(button.parentElement!).getByRole('status')).toHaveTextContent('Sharing is unavailable')
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
  })
  it('shows an accessible import path and no export buttons for an empty book', async () => {
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Import contacts' })).toHaveAttribute('href', '/import')
    expect(screen.queryByRole('button', { name: /Excel|CSV/ })).not.toBeInTheDocument()
  })
})
