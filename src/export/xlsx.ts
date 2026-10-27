import type { SheetTable } from './sheet'
import { zipFiles } from './zip'

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
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').slice(0, MAX_CELL)
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
      for (const line of (row[column] ?? '').split('\n')) longest = Math.max(longest, line.length)
    }
    return Math.min(48, Math.max(8, longest + 2))
  })
}

export function worksheetXml(table: SheetTable): string {
  const last = columnName(table.headers.length - 1) + (table.rows.length + 1)
  const header = `<row r="1">${table.headers.map((value, i) => cell(columnName(i) + 1, value, 1)).join('')}</row>`
  const body = table.rows.map((row, r) => `<row r="${r + 2}">${row.map((value, i) =>
    cell(columnName(i) + (r + 2), value, value.includes('\n') ? 2 : 0)).join('')}</row>`).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="A1:${last}"/>`
    + '<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
    + '<selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="B2" sqref="B2"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${widths(table).map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${header}${body}</sheetData>`
    + `<autoFilter ref="A1:${last}"/>`
    + '</worksheet>'
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
  const part = (path: string, text: string) => new File([text], path, { type: 'application/xml' })
  return zipFiles([
    part('[Content_Types].xml', STATIC['[Content_Types].xml']),
    part('_rels/.rels', STATIC['_rels/.rels']),
    part('xl/workbook.xml', workbookXml(table.rows.length, table.headers.length)),
    part('xl/_rels/workbook.xml.rels', STATIC['xl/_rels/workbook.xml.rels']),
    part('xl/styles.xml', STATIC['xl/styles.xml']),
    part('xl/worksheets/sheet1.xml', worksheetXml(table)),
  ], name, XLSX_TYPE)
}
