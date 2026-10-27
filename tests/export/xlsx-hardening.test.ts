import { afterEach, describe, expect, it, vi } from 'vitest'
import { worksheetXml, xlsxFile } from '@/export/xlsx'
import * as progress from '@/import/progress'

const documentFor = (value: string) => new DOMParser().parseFromString(
  worksheetXml({ headers: ['Notes'], rows: [[value]] }), 'application/xml')
const textFor = (value: string) => documentFor(value).querySelector('c[r="A2"] t')!.textContent

afterEach(() => vi.restoreAllMocks())
describe('XLSX text and limits', () => {
  it('removes lone surrogates and XML controls while preserving Unicode pairs', () => {
    const doc = documentFor('José 中文 😀 שלום\uD800x\uDC00\u0000\u000B\uFFFE\uFFFF')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector('c[r="A2"] t')!.textContent).toBe('José 中文 😀 שלוםx')
  })
  it('truncates without splitting a supplementary character', () => {
    expect(textFor('x'.repeat(32766) + '😀z')).toBe('x'.repeat(32766))
    expect(textFor('x'.repeat(32765) + '😀z')).toBe('x'.repeat(32765) + '😀')
  })
  it('normalizes line endings and wraps CR-only notes, preserving edge whitespace', () => {
    const doc = documentFor(' \tA\rB\r\nC\nD\t ')
    expect(doc.querySelector('c[r="A2"]')!.getAttribute('s')).toBe('2')
    expect(doc.querySelector('c[r="A2"] t')!.textContent).toBe(' \tA\nB\nC\nD\t ')
    expect(documentFor('a\rb').querySelector('c[r="A2"]')!.getAttribute('s')).toBe('2')
  })
  it('escapes literal SpreadsheetML escape sequences only once', () => {
    expect(textFor('_x0041_ _x005F_ _x000D_')).toBe('_x005F_x0041_ _x005F_x005F_ _x005F_x000D_')
  })
  it('rejects excess rows including the header before traversing them', async () => {
    const table = { headers: ['Name'], rows: new Array<string[]>(1048576) }
    expect(() => worksheetXml(table)).toThrow(/row limit/i)
    await expect(xlsxFile(table)).rejects.toThrow(/row limit/i)
  })
  it('rejects empty, oversized, or inconsistent columns', () => {
    expect(() => worksheetXml({ headers: [], rows: [] })).toThrow(/column/i)
    expect(() => worksheetXml({ headers: new Array<string>(16385), rows: [] })).toThrow(/column/i)
    expect(() => worksheetXml({ headers: ['Name'], rows: [['A', 'B']] })).toThrow(/column/i)
    expect(worksheetXml({ headers: Array.from({ length: 16384 }, () => ''), rows: [] })).toContain('A1:XFD1')
  })
  it('yields repeatedly while building large sheets', async () => {
    const yieldSpy = vi.spyOn(progress, 'yieldToBrowser').mockResolvedValue()
    await xlsxFile({ headers: ['Name', 'Notes'], rows: Array.from({ length: 10001 }, (_, i) => [`Person ${i}`, '文'.repeat(200)]) })
    expect(yieldSpy.mock.calls.length).toBeGreaterThan(10)
  })
})
