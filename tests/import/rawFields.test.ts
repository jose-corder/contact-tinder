import { describe, expect, it } from 'vitest'
import { parseVcf } from '@/import/vcard'
import { mergeContacts } from '@/import/dedupe'
import { rawCards } from '@/import/metadata'
import { readRawFields } from '@/import/rawFields'
import { formatDate } from '@/ui/format'

const card = (fields: string) => 'BEGIN:VCARD\nFN:Alex\nEMAIL:alex@example.test\n' + fields + '\nEND:VCARD'
describe('all preserved source fields (#42/#46)', () => {
  it('reads secondary records, scoped Apple labels, addresses, dates and websites once', () => {
    const primary = card('ORG:Studio\nTITLE:Engineer\nNOTE:Main note\nTEL:+12025550101\nX-ONE:one\nX-TWO:two\nX-THREE:three\nitem1.URL:https://main.test\nitem1.X-ABLabel:Portfolio')
    const extra = card('BDAY:19901012\nANNIVERSARY:2020-01-02\nitem1.ADR:;;12 Main St\\; Apt 2;City;;12345;Country\nitem1.X-ABLabel:_$!<Home>!$_\nitem2.URL:https://other.test\nitem2.X-ABLabel:Blog\nX-CUSTOM;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Caf=C3=A9')
    const merged = mergeContacts(parseVcf(extra), parseVcf(primary)).toUpsert[0]
    expect(merged.raw).toBe(primary)
    expect(rawCards(merged)).toHaveLength(2)
    const fields = readRawFields(merged)
    expect(fields).toContainEqual({ label: 'Birthday', value: formatDate('19901012'), kind: 'date' })
    expect(fields).toContainEqual({ label: 'Anniversary', value: formatDate('2020-01-02'), kind: 'date' })
    expect(fields).toContainEqual({ label: 'Home', value: '12 Main St; Apt 2, City, 12345, Country', kind: 'address' })
    expect(fields).toContainEqual({ label: 'Blog', value: 'https://other.test', href: 'https://other.test/', kind: 'url' })
    expect(fields).toContainEqual({ label: 'Portfolio', value: 'https://main.test', href: 'https://main.test/', kind: 'url' })
    expect(fields).toContainEqual({ label: 'X-CUSTOM', value: 'Café', kind: 'text' })
    expect(fields.some(field => ['Phone', 'Email', 'Role', 'Organization', 'Notes', 'X-ABLABEL'].includes(field.label))).toBe(false)
    expect(readRawFields(mergeContacts(parseVcf(extra), [merged]).toUpsert[0])).toEqual(fields)
  })
  it('deduplicates decoded values, unfolds text and rejects unsafe links', () => {
    const contact = parseVcf(card('URL:javascript:alert(1)\nNICKNAME:Alexan\n der\nBDAY:--1012'))[0]
    const fields = readRawFields({ ...contact, rawCards: [card('NICKNAME:Alexander')] } as typeof contact)
    expect(fields.filter(field => field.label === 'Nickname')).toEqual([{ label: 'Nickname', value: 'Alexander', kind: 'text' }])
    expect(fields.find(field => field.label === 'Website')?.href).toBeUndefined()
    expect(fields.find(field => field.label === 'Birthday')?.value).not.toContain('2000')
    expect(fields.find(field => field.label === 'Birthday')?.value).not.toBe('--1012')
  })
  it('retains differing secondary organization and title values', () => {
    const a = parseVcf(card('ORG:Current\nTITLE:Lead'))[0]
    const b = parseVcf(card('ORG:Earlier\nTITLE:Assistant'))[0]
    const fields = readRawFields(mergeContacts([b], [a]).toUpsert[0])
    expect(fields).toContainEqual({ label: 'Organization', value: 'Earlier', kind: 'text' })
    expect(fields).toContainEqual({ label: 'Role', value: 'Assistant', kind: 'text' })
  })
})
