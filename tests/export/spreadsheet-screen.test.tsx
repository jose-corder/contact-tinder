import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { resetAll, saveDecision, upsertContacts } from '@/db/repo'
import ExportScreen from '@/features/export/ExportScreen'
import { mergeContactFields } from '@/import/dedupe'
import { metadata } from '@/import/metadata'
import { parseCsv } from '@/import/csv'
import { readRawFields } from '@/import/rawFields'
import { XLSX_TYPE } from '@/export/xlsx'
import { row } from './fixtures'

let created: Blob[] = []
beforeEach(async () => {
  created = []
  await resetAll()
  await upsertContacts([row('Ada').contact, row('Bea').contact])
  await saveDecision(row('Ada', { bucket: 'work', workStatus: 'current', updatedAt: 5 }).decision)
  vi.stubGlobal('navigator', { userAgent: 'Desktop' })
  vi.stubGlobal('URL', { createObjectURL: vi.fn((blob: Blob) => { created.push(blob); return 'blob:download' }), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('spreadsheet export', () => {
  it('offers Excel and CSV on the main Export screen, outside More exports', async () => {
    render(<MemoryRouter><ExportScreen /></MemoryRouter>)
    const section = (await screen.findByRole('heading', { name: 'Spreadsheet' })).closest('section')!
    expect(section.closest('details')).toBeNull()
    expect(within(section).getByText('2 contacts · all-contacts.xlsx')).toBeInTheDocument()
    fireEvent.click(within(section).getByRole('button', { name: 'Prepare Excel spreadsheet' }))
    const download = await within(section).findByRole('button', { name: 'Download Excel spreadsheet' })
    fireEvent.click(download)
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce())
    const file = created.at(-1) as File
    expect(file.name).toBe('all-contacts.xlsx')
    expect(file.type).toBe(XLSX_TYPE)
    expect(within(section).getByRole('button', { name: 'Prepare CSV' })).toBeEnabled()
  })
})

describe('stored contact details', () => {
  const csv = (address: string) => parseCsv(`Name,Phone 1 - Value,Address 1 - Label,Address 1 - Formatted,Birthday\nAna,+12025550101,Home,${address},1990-05-12`, 'US')[0]

  it('shows CSV details in the contact field list', () => {
    expect(readRawFields(csv('1 Main St'))).toEqual(expect.arrayContaining([
      { label: 'Address · Home', value: '1 Main St', kind: 'address' },
      { label: 'Birthday', value: '1990-05-12', kind: 'text' },
    ]))
  })

  it('keeps both duplicates’ details when they merge', () => {
    const merged = mergeContactFields(csv('1 Main St'), csv('9 Office Rd'), 'US')
    expect(metadata(merged).details?.map((detail) => detail.value)).toEqual(['1990-05-12', '1 Main St', '9 Office Rd'])
  })
})
