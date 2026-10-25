// Findings #9/#34/#39/#41: phase headings, throttled speech, type roles and literal actions.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from '@/ui/toast'
import ImportScreen from '@/features/import/ImportScreen'
import { importContacts, importDemo, previewFiles, commitPreview, type ImportResult, type ImportPreview } from '@/import'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'
import { makeContact } from '@/import/contact'

vi.mock('@/import', () => ({ importContacts: vi.fn(), importDemo: vi.fn(), previewFiles: vi.fn(), commitPreview: vi.fn() }))
vi.mock('@/import/contactPicker', () => ({ isContactPickerSupported: vi.fn(), pickContacts: vi.fn() }))
vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))

const result: ImportResult = { added: 2, merged: 1, total: 3, errors: [], possibleDuplicates: [], decisionsMigrated: 0 }
const preview: ImportPreview = { ...result, mergePairs: [], keptApartPairs: [], photos: 0, skipped: 0, allAlreadyImported: false,
  contacts: ['Ada', 'Grace', 'Lin'].map((displayName) => makeContact({ displayName, org: 'Studio', phones: [], emails: [] }, 'vcf')!) }

function show() {
  return render(<MemoryRouter initialEntries={['/import']}><Routes>
    <Route path="/import" element={<ImportScreen />} />
    <Route path="/deck/triage" element={<p>Triage deck</p>} />
  </Routes></MemoryRouter>)
}
const choose = (files = [new File(['card'], 'contacts.vcf')]) =>
  fireEvent.change(screen.getByLabelText('Choose contact files'), { target: { files } })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(importDemo).mockResolvedValue(result)
  vi.mocked(previewFiles).mockResolvedValue(preview)
  vi.mocked(commitPreview).mockResolvedValue(result)
  vi.mocked(importContacts).mockResolvedValue(result)
  vi.mocked(isContactPickerSupported).mockReturnValue(false)
})
afterEach(cleanup)

describe('Import screen', () => {
  // Findings #9/#35: each step replaces the last, while merge details stay inspectable.
  it('replaces choose with inspectable preview and result, then resets for another import', async () => {
    vi.mocked(previewFiles).mockResolvedValue({ ...preview,
      mergePairs: [{ names: ['Maria Gomez', 'María Gómez'], reason: 'same phone' }],
      keptApartPairs: [{ names: ['Alice Smith', 'Bob Smith'], reason: 'shared phone, different names' }],
      possibleDuplicates: [{ ids: ['alice', 'bob'], reason: 'Different names' }],
    })
    show()
    choose()
    await screen.findByRole('region', { name: 'Import preview' })
    expect(screen.queryByText('How to export your contacts')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Choose contact files')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('t-title')
    // #9: confirmation precedes optional samples and merge details in DOM/focus order.
    const confirm = screen.getByRole('button', { name: 'Import 3' })
    expect(confirm.compareDocumentPosition(screen.getByText('Preview sample contacts')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(confirm.compareDocumentPosition(screen.getByText('See what merges')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Review your import' })).toHaveFocus()
    fireEvent.click(screen.getByText('See what merges'))
    expect(screen.getByText('Maria Gomez ↔ María Gómez · same phone')).toBeVisible()
    expect(screen.getByText('Alice Smith · Bob Smith · shared phone, different names')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Import 3' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Import another' }))
    expect(screen.getByLabelText('Choose contact files')).toBeVisible()
    expect(screen.getByText('How to export your contacts')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sort contacts' })).not.toBeInTheDocument()
  })

  it('import_announces_completion_once', async () => {
    vi.mocked(importDemo).mockResolvedValue({ ...result, possibleDuplicates: [{ ids: ['a', 'b'], reason: 'Names differ' }],
      storageNote: 'Device storage is getting full.' })
    const { container } = show()
    // #34: InlineNotice owns the implicit polite status region; do not nest live regions.
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Try 40 sample contacts' }))
    await screen.findByText('2 contacts added · 1 duplicate entries merged')
    const announcer = screen.getByRole('status')
    expect(announcer).toHaveTextContent('2 contacts added · 1 duplicate entries merged')
    expect(announcer.querySelector('button')).toBeNull()
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(toast).not.toHaveBeenCalled()
    expect(screen.getByText('1 possible duplicates kept apart')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review possible duplicates (1)' })).toHaveAttribute('href', '/review?tab=unsorted&dupes=1') // #35
    expect(screen.getByText('Device storage is getting full.')).toBeInTheDocument()
  })

  it('keeps the headline, privacy, formats, and tabbed instructions', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Bring your contacts.' })).toBeInTheDocument()
    expect(screen.getByText('Your contacts are processed here. Nothing is uploaded.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pick from phone' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Choose contact files')).toHaveAttribute('accept', '.vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv')
    expect(screen.getByLabelText('Choose contact files')).toHaveAttribute('multiple')
    for (const name of ['iPhone', 'iCloud.com', 'Google', 'Outlook']) {
      fireEvent.click(screen.getByRole('tab', { name }))
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
      expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    }
    fireEvent.click(screen.getByText('Why a file?'))
    expect(screen.getByText(/iPhone Safari does not/)).toBeVisible()
    expect(screen.getByText(/Files app under Browse/)).toBeVisible()
  })

  it('shows counts and three samples before saving, then starts triage', async () => {
    show()
    const files = [new File(['card'], 'contacts.vcf'), new File(['csv'], 'contacts.csv')]
    choose(files)
    expect(previewFiles).toHaveBeenCalledWith(files, expect.any(Function))
    expect(await screen.findByText('3 contacts found · 1 duplicates will merge')).toBeInTheDocument()
    const block = screen.getByRole('region', { name: 'Import preview' })
    fireEvent.click(within(block).getByText('Preview sample contacts'))
    expect(within(block).getAllByRole('listitem')).toHaveLength(3)
    expect(within(block).getByText('Ada')).toBeInTheDocument()
    expect(commitPreview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Import 3' }))
    expect(commitPreview).toHaveBeenCalledWith(preview, expect.any(Function))
    await screen.findByText('2 contacts added · 1 duplicate entries merged')
    fireEvent.click(screen.getByRole('button', { name: 'Sort contacts' }))
    expect(screen.getByText('Triage deck')).toBeInTheDocument()
  })

  it('cancels without saving and permits another file', async () => {
    show()
    choose()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(commitPreview).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Choose contact files')).toBeEnabled()
  })

  it('handles dropped files and prevents replacement while awaiting confirmation', async () => {
    show()
    const file = new File(['card'], 'contacts.vcf')
    const zone = screen.getByLabelText('Choose contact files').parentElement!
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    await screen.findByRole('button', { name: 'Import 3' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(previewFiles).toHaveBeenCalledTimes(1)
    // Finding #9: obsolete choose controls unmount in later phases.
    expect(screen.queryByLabelText('Choose contact files')).not.toBeInTheDocument()
  })

  it('shows all-already-imported and Done without another write', async () => {
    vi.mocked(previewFiles).mockResolvedValue({ ...preview, total: 912, added: 0, merged: 912, allAlreadyImported: true })
    show()
    choose()
    await screen.findByText('All 912 already imported')
    expect(screen.queryByRole('button', { name: 'Import 912' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(commitPreview).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Choose contact files')).toBeEnabled()
  })

  it('shows phase, a 2px progress bar and tabular count; locks actions during parsing', async () => {
    let finish!: (value: ImportPreview) => void
    vi.mocked(previewFiles).mockImplementation((_files, progress) => {
      progress?.({ phase: 'parsing', parsed: 1240, total: 2000 })
      return new Promise((resolve) => { finish = resolve })
    })
    show()
    choose()
    expect(screen.getByRole('status')).toHaveTextContent('Parsing 1,240 contacts')
    expect(screen.getByText('parsing')).toHaveClass('eyebrow')
    expect(screen.getByRole('progressbar')).toHaveClass('h-[2px]')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1240')
    // Finding #9: obsolete choose controls unmount in later phases.
    expect(screen.queryByLabelText('Choose contact files')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try 40 sample contacts' })).not.toBeInTheDocument()
    await act(async () => finish(preview))
    // Finding #30: keep one stable announcer mounted.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps demo import one tap', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Try 40 sample contacts' }))
    await screen.findByText('2 contacts added · 1 duplicate entries merged')
    expect(previewFiles).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument()
  })

  it('shows calm empty-file errors without an import confirmation', async () => {
    const error = 'Nothing we could read in `export.csv`. Try the vCard export instead.'
    vi.mocked(previewFiles).mockResolvedValue({ ...preview, total: 0, contacts: [], errors: [error] })
    show()
    choose()
    expect(await screen.findByRole('alert')).toHaveTextContent(error)
    // Findings #24/#34: calm recovery text with a local retry.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument()
  })

  it('shows skipped-card errors beside successful preview and commit', async () => {
    const errors = ['partial.vcf: 2 unreadable cards skipped. The rest are ready to import.']
    vi.mocked(previewFiles).mockResolvedValue({ ...preview, skipped: 2, errors })
    vi.mocked(commitPreview).mockResolvedValue({ ...result, errors })
    show()
    choose()
    expect(await screen.findByRole('alert')).toHaveTextContent('2 unreadable cards skipped')
    fireEvent.click(screen.getByRole('button', { name: 'Import 3' }))
    await screen.findByRole('button', { name: 'Sort contacts' })
    expect(screen.getByRole('alert')).toHaveTextContent('2 unreadable cards skipped')
  })

  it('retains the selected contacts in a dedicated error phase for retry', async () => {
    vi.mocked(commitPreview).mockRejectedValueOnce(new Error('Storage full'))
    show()
    choose()
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full')
    // Finding #9: recovery is the only current phase, with a dedicated Retry action.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('2 contacts added · 1 duplicate entries merged')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles phone picker cancellation without an error', async () => {
    vi.mocked(isContactPickerSupported).mockReturnValue(true)
    vi.mocked(pickContacts).mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Pick from phone' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pick from phone' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(importContacts).not.toHaveBeenCalled()
  })
})
