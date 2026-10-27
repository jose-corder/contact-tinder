import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareSheet, SHEET_HEADERS, sheetRow, sheetTable } from '@/export/sheet'
import { csvFile, csvText } from '@/export/csv'
import { fileBytes } from '@/export/zip'
import { metadata } from '@/import/metadata'
import * as progress from '@/import/progress'
import { row } from './fixtures'

afterEach(() => vi.restoreAllMocks())
describe('sheet fidelity and preparation', () => {
  it('keeps conflicting birthdays from merged source records', () => {
    const entry = row('Merged')
    metadata(entry.contact).details = [{ kind: 'birthday', value: '1990-05-12' }, { kind: 'birthday', value: '1991-05-12' }]
    expect(sheetRow(entry)[SHEET_HEADERS.indexOf('Birthday')]).toBe('1990-05-12; 1991-05-12')
  })
  it('distinguishes list delimiters inside tags and groups from separate entries', () => {
    const entry = row('Lists', { customTags: ['a; b', 'a', 'b', 'Family, friends'] })
    metadata(entry.contact).details = [{ kind: 'group', value: 'a; b' }, { kind: 'group', value: 'a' }, { kind: 'group', value: 'b' }]
    const cells = sheetRow(entry)
    expect(cells[SHEET_HEADERS.indexOf('Tags')]).toBe('"a; b"; a; b; Family, friends')
    expect(cells[SHEET_HEADERS.indexOf('Groups')]).toBe('"a; b"; a; b')
  })
  it('yields during contact projection and preserves table order and contents', async () => {
    const yieldSpy = vi.spyOn(progress, 'yieldToBrowser').mockResolvedValue()
    const rows = Array.from({ length: 10001 }, (_, i) => row(`Person ${i}`))
    const table = await prepareSheet(rows)
    expect(table).toEqual(sheetTable(rows))
    expect(yieldSpy.mock.calls.length).toBeGreaterThan(10)
  })
  it('creates CSV in chunks with identical BOM, headers, quoting and row separators', async () => {
    const yieldSpy = vi.spyOn(progress, 'yieldToBrowser').mockResolvedValue()
    const rows = Array.from({ length: 1001 }, (_, i) => {
      const entry = row(`=José ${i}`)
      entry.contact.notes = '中文 "quote", semi; colon: next\r\n'.repeat(30)
      return entry
    })
    const file = await csvFile(rows, 'all-contacts.csv')
    expect(file.name).toBe('all-contacts.csv')
    expect(file.type).toBe('text/csv')
    expect(Buffer.from(await fileBytes(file)).equals(Buffer.from(csvText(rows), 'utf8'))).toBe(true)
    expect(yieldSpy.mock.calls.length).toBeGreaterThan(1)
  })
  it('creates a header-only CSV for no contacts', async () => {
    expect(Buffer.from(await fileBytes(await csvFile([]))).toString('utf8')).toBe(csvText([]))
  })
})
