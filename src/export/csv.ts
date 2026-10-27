import Papa from 'papaparse'
import type { ContactWithDecision } from '@/db/repo'
import { sheetTable } from './sheet'

export function csvText(rows: ContactWithDecision[]): string {
  const table = sheetTable(rows)
  // A byte-order mark lets Excel open accented names as UTF-8.
  return '﻿' + Papa.unparse({ fields: table.headers, data: table.rows }, { escapeFormulae: true })
}
