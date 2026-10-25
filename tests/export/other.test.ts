import { beforeEach, describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { allWithDecisions, resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import { cleanFile, groupFiles, vcfText } from '@/export/vcf'
import { csvText } from '@/export/csv'
import { backupJson, restoreJson } from '@/export/json'
import { row } from './fixtures'

beforeEach(resetAll)
describe('Other relation exports (#7/#51)', () => {
  const rows = [row('other-only', { bucket: 'personal', relation: 'other' }),
    row('other-type', { bucket: 'personal', relation: 'other', personalTypes: ['neighbor'] })]
  it('includes Other with and without types in clean, Personal and Other files', () => {
    const files = groupFiles(rows)
    expect(cleanFile(rows).rows).toEqual(rows)
    expect(files.find((f) => f.filename === 'personal.vcf')?.rows).toEqual(rows)
    const other = files.find((f) => f.filename === 'personal-other.vcf')!
    expect(other.description).toBe('Personal · Other')
    expect(other.rows).toEqual(rows)
    expect(vcfText(other.rows)).toContain('CATEGORIES:Personal,Other\r\n')
    expect(vcfText(other.rows)).toContain('CATEGORIES:Personal,Other,Neighbor')
    expect(files.find((f) => f.filename === 'personal-neighbor.vcf')?.rows).toEqual([rows[1]])
  })
  it('writes Other in the CSV Relation column', () => {
    expect(Papa.parse<Record<string, string>>(csvText(rows), { header: true }).data.map((r) => r.Relation)).toEqual(['Other', 'Other'])
  })
  it('round trips Other and optional types in the backup', async () => {
    await upsertContacts(rows.map((r) => r.contact))
    await saveDecisions(rows.map((r) => r.decision))
    const backup = await backupJson()
    await resetAll()
    await restoreJson(backup)
    expect(await allWithDecisions()).toEqual(rows)
  })
})
