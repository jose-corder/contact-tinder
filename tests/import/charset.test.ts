import { describe, expect, it } from 'vitest'
import { previewFiles } from '@/import'
import { decodeFileBytes } from '@/import/readFile'
import { parseVcf } from '@/import/vcard'
import { buildVcard } from '@/export/vcf'
import { csvText } from '@/export/csv'
import { emptyDecision } from '@/domain/types'
import Papa from 'papaparse'

const literal = 'BEGIN:VCARD\r\nVERSION:2.1\r\nFN;CHARSET=windows-1252:Andr'

describe('legacy charset and structured fields', () => {
  it('vcard_21_charsets_and_grouped_labels: literal Windows-1252 bytes and raw round trip', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode(literal), 0xe9, ...new TextEncoder().encode('\r\nEND:VCARD\r\n')])
    const preview = await previewFiles([new File([bytes], 'legacy.vcf')])
    const contact = preview.contacts[0]
    expect(contact.displayName).toBe('André')
    expect(contact.raw).toContain('CHARSET=windows-1252:André')
    expect(parseVcf(buildVcard(contact, []))[0].displayName).toBe('André')
    expect(contact.raw).not.toContain('�')
    // Finding #13: the exported File contains UTF-8 bytes, even for legacy source text.
    expect(buildVcard(contact, [])).toContain('FN;CHARSET=UTF-8:André')
  })
  it('honors per-property literal charsets in mixed legacy files and UTF BOMs', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode(literal), 0xe9,
      ...new TextEncoder().encode('\r\nNOTE;CHARSET=UTF-8:日本\r\nEND:VCARD')])
    expect(parseVcf(decodeFileBytes(bytes.buffer))[0].notes).toBe('日本')
    const utf8 = new TextEncoder().encode('\uFEFFBEGIN:VCARD\nFN:André\nEND:VCARD')
    expect(parseVcf(decodeFileBytes(utf8.buffer))[0].displayName).toBe('André')
  })
  it('vcard_21_charsets_and_grouped_labels: Apple labels, ORG units and escaped separators', () => {
    const [contact] = parseVcf('BEGIN:VCARD\nFN:Alex\nitem1.TEL;TYPE=WORK:+12025550101\nitem1.X-ABLabel:_$!<Assistant>!$_\nitem2.X-ABLabel:Spouse\nitem2.EMAIL:alex@example.test\nORG:Acme\\; Inc.;Research;Biology\nEND:VCARD')
    expect(contact.phones[0].type).toBe('Assistant')
    expect(contact.emails[0].type).toBe('Spouse')
    expect(contact.org).toBe('Acme; Inc. · Research · Biology')
    const csv = Papa.parse<Record<string, string>>(csvText([{ contact, decision: emptyDecision(contact.id) }]), { header: true }).data[0]
    expect(csv.Organization).toBe('Acme; Inc.')
    expect(csv.Department).toBe('Research · Biology')
  })
})
