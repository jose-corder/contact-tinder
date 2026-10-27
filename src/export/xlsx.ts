import type { SheetTable } from './sheet'
import { zipFiles } from './zip'
import { yieldToBrowser } from '@/import/progress'

/**
 * Minimal Office Open XML workbook: one "Contacts" sheet of inline strings with a bold, frozen,
 * filterable header row and the Name column frozen. No dependencies; stored in the same ZIP writer.
 */
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_CELL = 32767

export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function xml(value: string): string {
  // XML 1.0 forbids most control characters; Excel also caps a cell at 32,767 characters.
  let text = value.replace(/\r\n|\r/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '').slice(0, MAX_CELL)
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
  return text.replace(/_x[\da-f]{4}_/gi, (escape) => '_x005F_' + escape.slice(1))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cell(ref: string, value: string, style: number): string {
  if (!value) return style ? `<c r="${ref}" s="${style}"/>` : ''
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function widths(table: SheetTable): number[] {
  return table.headers.map((header, column) => {
    let longest = header.length
    for (const row of table.rows.slice(0, 500)) {
      for (const line of (row[column] ?? '').split(/\r\n|\r|\n/)) longest = Math.max(longest, line.length)
    }
    return Math.min(48, Math.max(8, longest + 2))
  })
}

function* worksheetParts(table: SheetTable): Generator<string> {
  if (table.rows.length > 1048575) throw new Error('Excel row limit is 1,048,576 including the header.')
  if (!table.headers.length || table.headers.length > 16384) throw new Error('Excel column count must be between 1 and 16,384.')
  const last = columnName(table.headers.length - 1) + (table.rows.length + 1)
  const header = `<row r="1">${table.headers.map((value, i) => cell(columnName(i) + 1, value, 1)).join('')}</row>`
  yield '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="A1:${last}"/>`
    + '<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
    + '<selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="B2" sqref="B2"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${widths(table).map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${header}`
  for (let offset = 0; offset < table.rows.length; offset += 200) {
    yield table.rows.slice(offset, offset + 200).map((row, index) => {
      if (row.length > table.headers.length) throw new Error('Row exceeds the header column count.')
      const r = offset + index + 2
      return `<row r="${r}">${row.map((value, i) => cell(columnName(i) + r, value, /[\r\n]/.test(value) ? 2 : 0)).join('')}</row>`
    }).join('')
  }
  yield `</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
}

export function worksheetXml(table: SheetTable): string {
  return [...worksheetParts(table)].join('')
}

const STATIC: Record<string, string> = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>',
  'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>',
}

function workbookXml(rows: number, columns: number): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets>'
    + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Contacts!$A$1:$${columnName(columns - 1)}$${rows + 1}</definedName></definedNames>`
    + '</workbook>'
}

export async function xlsxFile(table: SheetTable, name = 'contacts.xlsx'): Promise<File> {
  const sheet: BlobPart[] = []
  for (const chunk of worksheetParts(table)) {
    sheet.push(new Blob([chunk]))
    if (table.rows.length > 1000) await yieldToBrowser()
  }
  const part = (path: string, text: string) => new File([text], path, { type: 'application/xml' })
  return zipFiles([
    part('[Content_Types].xml', STATIC['[Content_Types].xml']),
    part('_rels/.rels', STATIC['_rels/.rels']),
    part('xl/workbook.xml', workbookXml(table.rows.length, table.headers.length)),
    part('xl/_rels/workbook.xml.rels', STATIC['xl/_rels/workbook.xml.rels']),
    part('xl/styles.xml', STATIC['xl/styles.xml']),
    new File(sheet, 'xl/worksheets/sheet1.xml', { type: 'application/xml' }),
  ], name, XLSX_TYPE)
}
