import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { csvText } from '@/export/csv'
import { SHEET_HEADERS, sheetRow } from '@/export/sheet'
import { metadata } from '@/import/metadata'
import { row } from './fixtures'

describe('CSV hostile cells', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\ttext', '\rtext', '\n=1', '＝1+1', '＋1', '－1', '＠SUM(A1)', '  =1', '\uFEFF=1'])('neutralizes %j', (value) => {
    const entry = row('name')
    entry.contact.displayName = value
    const csv = csvText([entry])
    expect(Papa.parse<string[]>(csv).data[1][0]).toBe("'" + value)
  })
  it('keeps BOM, quoted multiline values, tags and a fixed column count', () => {
    const entries = [row('José 中文 😀 שלום', { bucket: 'delete', customTags: ['a,b', 'c; d'] }), row('Unsorted')]
    entries[0].contact.notes = '"quotes", semicolon; colon: text\r\nnext line'
    const csv = csvText(entries)
    const parsed = Papa.parse<string[]>(csv)
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(parsed.errors).toEqual([])
    expect(parsed.data.map((cells) => cells.length)).toEqual([49, 49, 49])
    expect(parsed.data[1][SHEET_HEADERS.indexOf('Notes')]).toBe(entries[0].contact.notes)
    expect(parsed.data[1][1]).toBe('Delete')
    expect(parsed.data[2][1]).toBe('Unsorted')
  })
  it('keeps overflow phone/email values whose labels contain list delimiters distinct', () => {
    const entry = row('Overflow')
    entry.contact.phones = ['1', '2', '3', 'b: c', 'c'].map((value, i) => ({ value, type: i === 3 ? 'a' : 'a: b' }))
    entry.contact.emails = ['a@a.test', 'b@b.test', 'c; d@example.test', 'e@example.test'].map((value) => ({ value, type: 'Work' }))
    const cells = sheetRow(entry)
    expect(cells).toHaveLength(SHEET_HEADERS.length)
    expect(cells[SHEET_HEADERS.indexOf('More phones')]).toBe('A: "b: c"; "A: b": c')
    expect(cells[SHEET_HEADERS.indexOf('More emails')]).toContain('"c; d@example.test"')
  })
  it('retains a formatted address when the structured object is empty', () => {
    const entry = row('Address')
    metadata(entry.contact).details = [{ kind: 'address', value: '1 Main St', address: {} }]
    expect(sheetRow(entry)[SHEET_HEADERS.indexOf('Street')]).toBe('1 Main St')
  })
})

describe('csv cell limit', () => {
  it('caps cells at Excel\'s limit without splitting an emoji so rows never spill', async () => {
    const r = row('long')
    r.contact.notes = '😀'.repeat(20000)
    const [parsed] = Papa.parse<Record<string, string>>(csvText([r]), { header: true, skipEmptyLines: true }).data
    expect(parsed.Notes.length).toBeLessThanOrEqual(32000)
    expect(parsed.Notes).toBe('😀'.repeat(parsed.Notes.length / 2))
  })
})
