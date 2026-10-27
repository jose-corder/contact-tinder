import { describe, expect, it } from 'vitest'
import { buildVcard } from '@/export/vcf'
import { mergeContactFields } from '@/import/dedupe'
import { contactDetails } from '@/import/details'
import { makeContact } from '@/import/contact'
import { parseVcfChunks } from '@/import/parseChunks'
import { parseVcf } from '@/import/vcard'

describe('import and export agree', () => {
  it('reads chunked vCards with classic Mac (CR-only) line endings', async () => {
    const text = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ana', 'TEL:+12025550101', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Bea', 'TEL:+12025550102', 'END:VCARD', ''].join('\r')
    const parsed = await parseVcfChunks(text, undefined, 'vcf', 'US')
    expect(parsed.contacts.map((contact) => contact.displayName)).toEqual(['Ana', 'Bea'])
  })

  it('keeps identical notes with repeated lines unchanged when duplicates merge', () => {
    const notes = 'Call back\nCall back\nVIP'
    const make = () => makeContact({ displayName: 'Ana', notes, phones: [{ value: '+12025550101' }], emails: [] }, 'csv', 'US')!
    expect(mergeContactFields(make(), make(), 'US').notes).toBe(notes)
  })

  it('round trips custom social and messaging labels written as Apple item labels', () => {
    const source = makeContact({ displayName: 'Ana', phones: [{ value: '+12025550101' }], emails: [], details: [
      { kind: 'social', value: 'ana.lane', label: 'Mastodon: fediverse' },
      { kind: 'messaging', value: 'ana', label: 'Signal' },
    ] }, 'csv', 'US')!
    const [back] = parseVcf(buildVcard(source, []), 'vcf', 'US')
    expect(contactDetails(back).filter((detail) => detail.kind === 'social' || detail.kind === 'messaging')
      .map(({ kind, value, label }) => ({ kind, value, label }))).toEqual([
      { kind: 'social', value: 'ana.lane', label: 'Mastodon: fediverse' },
      { kind: 'messaging', value: 'ana', label: 'Signal' },
    ])
  })
})
