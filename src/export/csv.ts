import Papa from 'papaparse'
import type { ContactWithDecision } from '@/db/repo'
import { SHEET_HEADERS, sheetRow } from './sheet'
import { yieldToBrowser } from '@/import/progress'

const escapeFormulae = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠\t\r\n]/
// Excel's CSV opener spills an over-long cell into a new row a little before its 32,767-character cell limit.
const MAX_CELL = 32000
const cap = (value: string) => value.length <= MAX_CELL ? value
  : value.slice(0, /[\uD800-\uDBFF]/.test(value[MAX_CELL - 1]) ? MAX_CELL - 1 : MAX_CELL)
const csvRow = (row: ContactWithDecision) => sheetRow(row).map(cap)

export function csvText(rows: ContactWithDecision[]): string {
  // A byte-order mark lets Excel open accented names as UTF-8.
  return '﻿' + Papa.unparse({ fields: SHEET_HEADERS, data: rows.map(csvRow) }, { escapeFormulae })
}

export async function csvFile(rows: ContactWithDecision[], name = 'contacts.csv'): Promise<File> {
  const parts: BlobPart[] = [new Blob([csvText(rows.slice(0, 200))])]
  if (rows.length > 1000) await yieldToBrowser()
  for (let offset = 200; offset < rows.length; offset += 200) {
    parts.push(new Blob(['\r\n', Papa.unparse(rows.slice(offset, offset + 200).map(csvRow), { escapeFormulae })]))
    if (rows.length > 1000) await yieldToBrowser()
  }
  return new File(parts, name, { type: 'text/csv' })
}
