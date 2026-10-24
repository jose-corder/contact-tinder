import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import ImportScreen from '@/features/import/ImportScreen'
import { importContacts, importDemo, importFiles, type ImportResult } from '@/import'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'

vi.mock('@/import', () => ({ importContacts: vi.fn(), importDemo: vi.fn(), importFiles: vi.fn() }))
vi.mock('@/import/contactPicker', () => ({ isContactPickerSupported: vi.fn(), pickContacts: vi.fn() }))

const result: ImportResult = { added: 2, merged: 1, total: 3, errors: [] }

function show() {
  return render(
    <MemoryRouter initialEntries={['/import']}>
      <Routes>
        <Route path="/import" element={<ImportScreen />} />
        <Route path="/deck/triage" element={<p>Triage deck</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(importDemo).mockResolvedValue(result)
  vi.mocked(importFiles).mockResolvedValue(result)
  vi.mocked(importContacts).mockResolvedValue(result)
  vi.mocked(isContactPickerSupported).mockReturnValue(false)
})
afterEach(cleanup)

describe('Import screen', () => {
  it('explains privacy, provides the accepted file formats and export instructions', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Bring your contacts.' })).toBeInTheDocument()
    expect(screen.getByText('Nothing leaves this device.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pick from phone' })).not.toBeInTheDocument()
    const input = screen.getByLabelText('Choose contact files')
    expect(input).toHaveAttribute('multiple')
    expect(input).toHaveAttribute('accept', '.vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv')
    fireEvent.click(screen.getByText('How to export your contacts'))
    expect(screen.getByText('iPhone')).toBeVisible()
    expect(screen.getByText('iCloud.com')).toBeVisible()
    expect(screen.getByText('Google Contacts')).toBeVisible()
    expect(screen.getByText('Outlook')).toBeVisible()
  })

  it('imports multiple chosen files and starts triage', async () => {
    show()
    const files = [new File(['card'], 'contacts.vcf'), new File(['csv'], 'contacts.csv')]
    fireEvent.change(screen.getByLabelText('Choose contact files'), { target: { files } })
    expect(importFiles).toHaveBeenCalledWith(files)
    expect(await screen.findByText('2 imported · 1 merged')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start triage' }))
    expect(screen.getByText('Triage deck')).toBeInTheDocument()
  })

  it('handles dropped files', async () => {
    show()
    const file = new File(['card'], 'contacts.vcf')
    fireEvent.drop(screen.getByLabelText('Choose contact files').parentElement!, { dataTransfer: { files: [file] } })
    expect(importFiles).toHaveBeenCalledWith([file])
    await screen.findByText('2 imported · 1 merged')
  })

  it('disables import actions and rejects extra drops while busy', async () => {
    let finish!: (value: ImportResult) => void
    vi.mocked(importDemo).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Try with 40 demo contacts' }))
    expect(screen.getByRole('status')).toHaveTextContent('Importing your contacts…')
    expect(screen.getByLabelText('Choose contact files')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Try with 40 demo contacts' })).toBeDisabled()
    fireEvent.drop(screen.getByLabelText('Choose contact files').parentElement!, { dataTransfer: { files: [new File([], 'extra.vcf')] } })
    expect(importFiles).not.toHaveBeenCalled()
    await act(async () => finish(result))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Choose contact files')).toBeEnabled()
  })

  it('shows per-file errors alongside successful imports', async () => {
    vi.mocked(importFiles).mockResolvedValue({ ...result, errors: ['bad.csv: No contacts found.'] })
    show()
    fireEvent.change(screen.getByLabelText('Choose contact files'), { target: { files: [new File([], 'bad.csv')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('bad.csv: No contacts found.')
    expect(screen.getByRole('button', { name: 'Start triage' })).toBeInTheDocument()
  })

  it('shows failures and allows a retry', async () => {
    vi.mocked(importDemo).mockRejectedValueOnce(new Error('Storage full'))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Try with 40 demo contacts' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full')
    expect(screen.queryByRole('button', { name: 'Start triage' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try with 40 demo contacts' }))
    await screen.findByText('2 imported · 1 merged')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows supported phone picker and handles cancellation without an error', async () => {
    vi.mocked(isContactPickerSupported).mockReturnValue(true)
    vi.mocked(pickContacts).mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Pick from phone' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pick from phone' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(importContacts).not.toHaveBeenCalled()
    vi.mocked(pickContacts).mockResolvedValueOnce([])
    fireEvent.click(screen.getByRole('button', { name: 'Pick from phone' }))
    await waitFor(() => expect(importContacts).toHaveBeenCalledWith([]))
    await screen.findByText('2 imported · 1 merged')
  })
})
