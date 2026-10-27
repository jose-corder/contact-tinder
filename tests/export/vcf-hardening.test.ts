import { describe, expect, it } from 'vitest'
import { buildVcard } from '@/export/vcf'
import { contactDetails, labeledEntries, type ContactDetail } from '@/import/details'
import { metadata } from '@/import/metadata'
import { parseVcf } from '@/import/vcard'
import { logicalLines, property } from '@/import/vcardCodec'
import { contact } from './fixtures'

const exported = (details: ContactDetail[]) => {
  const c = contact('rich', 'José 中文 😀 שלום')
  metadata(c).details = details
  return buildVcard(c, [])
}
const importedDetails = (card: string) => contactDetails(parseVcf(card, 'vcf', 'US')[0])

describe('raw-less vCard write-back', () => {
  it('uses valid fallback TYPE tokens for punctuation-only labels', () => {
    const c = contact('punctuation')
    c.phones = [{ value: '12345', type: ',,;' }]
    c.emails = [{ value: 'a@example.test', type: ',,;' }]
    const card = buildVcard(c, [])
    expect(card).toContain('TEL;TYPE=CELL:12345')
    expect(card).toContain('EMAIL;TYPE=INTERNET:a@example.test')
    expect(card).not.toContain('TYPE=,,')
  })
  it('preserves custom address, phone and email labels without parameter injection', () => {
    const label = '家: Work; "Desk", mobile\nX-EVIL:injected'
    const c = contact('labels')
    c.phones = [{ value: '+12025550101', type: label }]
    c.emails = [{ value: 'a@example.test', type: label }]
    metadata(c).details = [{ kind: 'address', value: '1 Main St', label }]
    const card = buildVcard(c, [])
    const parsed = parseVcf(card, 'vcf', 'US')[0]
    expect(labeledEntries(parsed).phones[0].label).toBe(label)
    expect(labeledEntries(parsed).emails[0].label).toBe(label)
    expect(contactDetails(parsed).find((detail) => detail.kind === 'address')?.label).toBe(label)
    expect(logicalLines(card).some((line) => property(line)?.name === 'X-EVIL')).toBe(false)
    const groups = logicalLines(card).map(property).filter((p) => p?.name === 'X-ABLABEL').map((p) => p!.group)
    expect(new Set(groups).size).toBe(groups.length)
  })
  it('keeps a formatted address even when its structured fields are empty', () => {
    expect(importedDetails(exported([{ kind: 'address', value: '1 Main St', address: {} }]))).toEqual([
      expect.objectContaining({ kind: 'address', value: '1 Main St' }),
    ])
  })
  it('does not prepend x-apple to messaging values that already have a scheme', () => {
    const card = exported([{ kind: 'messaging', value: 'sip:ana@example.test', label: 'SIP' }])
    expect(card).toContain('IMPP;X-SERVICE-TYPE=SIP:sip:ana@example.test')
    expect(card).not.toContain('x-apple:sip:')
  })
  it('round trips punctuation and non-English messaging service labels', () => {
    const label = 'チャット: home; "private", friends\nservice'
    expect(importedDetails(exported([{ kind: 'messaging', value: 'ana', label }]))).toContainEqual({ kind: 'messaging', value: 'ana', label })
  })
  it('retains custom social labels in escaped Apple labels without unsafe parameters', () => {
    const card = exported([{ kind: 'social', value: 'ana', label: '家: "friends"; social,\nprivate' }])
    expect(logicalLines(card)).toContain('item1.X-ABLabel:家: "friends"\\; social\\,\\nprivate')
    expect(logicalLines(card)).toContain('item1.X-SOCIALPROFILE:ana')
  })
  it('writes partial and compact dates and preserves unrepresentable dates in notes', () => {
    const card = exported([
      { kind: 'birthday', value: '--05-12' }, { kind: 'anniversary', value: '20150620' },
      { kind: 'date', value: 'sometime in spring', label: 'Met' }, { kind: 'date', value: 'February 31', label: 'Bad source' },
    ])
    expect(card).toContain('BDAY:--05-12')
    expect(card).toContain('X-ABDATE:2015-06-20')
    const parsed = parseVcf(card, 'vcf', 'US')[0]
    expect(parsed.notes).toContain('Met: sometime in spring')
    expect(parsed.notes).toContain('Bad source: February 31')
    expect(card).not.toContain('X-ABDATE:--02-31')
  })
  it('round trips a rich fixture with unique item groups and UTF-8 folding', () => {
    const street = 'Calle José; 大通り 😀 '.repeat(12).trim()
    const details: ContactDetail[] = [
      { kind: 'prefix', value: 'Dr.' }, { kind: 'middle', value: 'Élodie' }, { kind: 'suffix', value: 'PhD' },
      { kind: 'nickname', value: 'Annie' }, { kind: 'address', value: `${street}, 東京`, label: 'Home', address: { street, city: '東京' } },
      { kind: 'birthday', value: 'May 12' }, { kind: 'anniversary', value: '2015-06-20' },
      { kind: 'date', value: '2020-01-02', label: 'Met: fair; friends' },
      { kind: 'website', value: 'https://example.test/a?q=1,2', label: 'Blog: personal' },
      { kind: 'social', value: 'ana', label: 'Twitter' }, { kind: 'messaging', value: 'ana.lane', label: 'Skype' },
      { kind: 'related', value: 'Bea; 王', label: 'Sister' }, { kind: 'group', value: 'Friends, family' },
    ]
    const c = contact('roundtrip', 'José 中文 😀 שלום')
    c.notes = 'Quotes " and slash \\; punctuation,\n'.repeat(30).trim()
    metadata(c).details = details
    const card = buildVcard(c, [])
    for (const line of card.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    const parsed = parseVcf(card, 'vcf', 'US')[0]
    expect(parsed.displayName).toBe(c.displayName)
    expect(parsed.notes).toBe(c.notes)
    expect(contactDetails(parsed)).toEqual(expect.arrayContaining(details.map((detail) => expect.objectContaining(detail))))
    expect(contactDetails(parsed)).toHaveLength(details.length)
  })
})
