import { describe, expect, it } from 'vitest'
import { parseVcf } from '@/import/vcard'
import { mergeContacts } from '@/import/dedupe'
import { metadata } from '@/import/metadata'
import { logicalLines } from '@/import/vcardCodec'
import { buildVcard, vcfText } from '@/export/vcf'
import { emptyDecision } from '@/domain/types'
import { contact } from './fixtures'

describe('vCard fidelity regressions', () => {
  it('preserves country-qualified phones when a shared email joins the same person', () => {
    const raw = 'BEGIN:VCARD\nFN:Same Person\nTEL:2025550101\nEMAIL:same@example.test\nEND:VCARD'
    const us = parseVcf(raw, 'vcf', 'US')[0]
    const mx = parseVcf(raw, 'vcf', 'MX')[0]
    const merged = mergeContacts([mx], [us]).toUpsert[0]
    expect(merged.phones).toHaveLength(2)
    const exported = parseVcf(buildVcard(merged, []), 'vcf', 'US')[0]
    expect(new Set(exported.phoneKeys)).toEqual(new Set(['+12025550101', '+522025550101']))
  })

  it('merged_vcard_exports_union_of_fields', () => {
    const a = 'BEGIN:VCARD\r\nFN:Alice\r\nEMAIL:alice@example.test\r\nTEL:+12025550101\r\nNOTE:First note\r\nX-ORIGINAL:one\r\nPHOTO;ENCODING=b:aGk=\r\nEND:VCARD\r\n'
    const b = 'BEGIN:VCARD\nFN:Alice\nEMAIL:alice@example.test\nEMAIL:other@example.test\nitem1.TEL:+12025550199\nitem1.X-ABLabel:_$!<Assistant>!$_\nNOTE:Second note\nX-OTHER:two\nEND:VCARD\n'
    const merged = mergeContacts(parseVcf(b), parseVcf(a)).toUpsert[0]
    expect(metadata(merged).rawCards).toHaveLength(1)
    const text = buildVcard(merged, ['Work'])
    const parsed = parseVcf(text)[0]
    expect(new Set(parsed.phones.map((p) => p.value))).toEqual(new Set(['+12025550101', '+12025550199']))
    expect(new Set(parsed.emails.map((p) => p.value))).toEqual(new Set(['alice@example.test', 'other@example.test']))
    expect(parsed.notes).toContain('First note')
    expect(parsed.notes).toContain('Second note')
    expect(text).toContain('X-ORIGINAL:one')
    expect(text).toContain('X-OTHER:two')
    expect(parsed.phones.find((p) => p.value === '+12025550199')?.type).toBe('Assistant')
    const repeated = mergeContacts(parseVcf(a + b), [merged]).toUpsert[0]
    expect(buildVcard(repeated, ['Work'])).toBe(text)
  })
  it('vcard_preserves_foreign_categories_and_unsorted_tags', () => {
    const [contact] = parseVcf('BEGIN:VCARD\nFN:A\nCATEGORIES:Family,VIP,Long\n Name,Comma\\,inside\nEND:VCARD \t\n')
    const text = vcfText([{ contact, decision: { ...emptyDecision(contact.id), customTags: ['local'], skips: { triage: 2, work: 0, personal: 0 } } }])
    expect(logicalLines(text).filter((line) => line.startsWith('CATEGORIES:'))).toEqual(['CATEGORIES:Family,VIP,LongName,Comma\\,inside,local'])
    expect(text).toContain('END:VCARD \t')
  })
  it('vcard_generated_lines_fold_utf8_without_splitting_codepoints', () => {
    const notes = '日本語🙂'.repeat(100)
    const labels = ['東京🙂'.repeat(60), 'Comma,inside']
    const text = buildVcard({ ...contact('unicode', notes), notes }, labels)
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(parseVcf(text)[0].notes).toBe(notes)
    expect(parseVcf(text)[0].displayName).toBe(notes)
    expect(logicalLines(text)).toContain('CATEGORIES:' + labels[0] + ',Comma\\,inside')
    expect(text).not.toContain('�')
  })
})
