import { describe, expect, it } from 'vitest'
import { columnName, XLSX_TYPE, xlsxFile } from '@/export/xlsx'
import { fileBytes } from '@/export/zip'

/** Reads the STORE-only archive our ZIP writer produces. */
async function entries(file: File): Promise<Map<string, string>> {
  const bytes = await fileBytes(file)
  const view = new DataView(bytes.buffer)
  const result = new Map<string, string>()
  for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
    const size = view.getUint32(at + 18, true), nameLength = view.getUint16(at + 26, true)
    const name = new TextDecoder().decode(bytes.slice(at + 30, at + 30 + nameLength))
    result.set(name, new TextDecoder().decode(bytes.slice(at + 30 + nameLength, at + 30 + nameLength + size)))
    at += 30 + nameLength + size
  }
  return result
}

describe('Excel export', () => {
  it('names columns like Excel', () => {
    expect([0, 25, 26, 51, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA'])
  })

  it('builds a well-formed workbook with a frozen, filterable header and safe text cells', async () => {
    const file = await xlsxFile({ headers: ['Name', 'Notes', 'Phone 1'], rows: [
      ['<b> & "co"', 'Line 1\nLine 2', '=1+1'],
      ['Bell\u0007 Ana', '', '+12025550101'],
    ] }, 'all-contacts.xlsx')
    expect(file.name).toBe('all-contacts.xlsx')
    expect(file.type).toBe(XLSX_TYPE)
    const parts = await entries(file)
    expect([...parts.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'])
    for (const [name, text] of parts) {
      expect(new DOMParser().parseFromString(text, 'application/xml').querySelector('parsererror'), name).toBeNull()
    }
    const sheet = parts.get('xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Name</t></is></c>')
    expect(sheet).toContain('<t xml:space="preserve">&lt;b&gt; &amp; &quot;co&quot;</t>')
    expect(sheet).toContain('<c r="B2" t="inlineStr" s="2">')
    // Values are text, never formulas.
    expect(sheet).toContain('<c r="C2" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c>')
    expect(sheet).not.toContain('<f>')
    expect(sheet).toContain('Bell Ana')
    expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>')
    expect(sheet).toContain('<autoFilter ref="A1:C3"/>')
    expect(parts.get('xl/workbook.xml')).toContain('Contacts!$A$1:$C$3')
  })

  it('caps very long cells at the Excel limit', async () => {
    const parts = await entries(await xlsxFile({ headers: ['Notes'], rows: [['x'.repeat(40000)]] }))
    expect(parts.get('xl/worksheets/sheet1.xml')!.match(/x+/g)!.sort((a, b) => b.length - a.length)[0]).toHaveLength(32767)
  })
})
