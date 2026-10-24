import { describe, expect, it } from 'vitest'
import { buildVcard, cleanFile, groupFiles, vcfText } from '@/export/vcf'
import { BUCKET_META, WORK_STATUS_META, PERSONAL_RELATION_META } from '@/domain/taxonomy'
import { contact, row } from './fixtures'
import { parseVcf } from '@/import/vcard'
import { mergeContacts } from '@/import/dedupe'

describe('vCard export', () => {
  it('exports all merged phone/email entries without changing the original raw or its photo', () => {
    const raw = 'BEGIN:VCARD\r\nFN:Ada\r\nTEL;TYPE=CELL:2025550101\r\nEMAIL:ada@example.com\r\nPHOTO;ENCODING=b:aGk=\r\nEND:VCARD\r\n'
    const extra = 'BEGIN:VCARD\r\nFN:Ada\r\nTEL:2025550102\r\nEMAIL:ada@example.com\r\nEMAIL:ada@home.test\r\nEND:VCARD\r\n'
    const merged = mergeContacts(parseVcf(extra), parseVcf(raw)).toUpsert[0]
    const before = merged.raw
    const exported = parseVcf(buildVcard(merged, ['Work']))[0]
    expect(exported.phones.map((p) => p.value)).toEqual(['2025550101', '2025550102'])
    expect(exported.emails.map((e) => e.value)).toEqual(['ada@example.com', 'ada@home.test'])
    expect(merged.raw).toBe(before)
    expect(buildVcard(merged, ['Work'])).toContain('PHOTO;ENCODING=b:aGk=\r\n')
  })

  it('adds labels before END with trailing whitespace', () => {
    expect(buildVcard({ ...contact('a'), raw: 'BEGIN:VCARD\nFN:A\nEND:VCARD \n' }, ['Work'])).toContain('CATEGORIES:Work\nEND:VCARD \n')
  })
  it('inserts labels immediately before END and preserves CRLF', () => {
    const c = { ...contact('a'), raw: 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana\r\nEND:VCARD\r\n' }
    expect(buildVcard(c, ['Work', 'Current'])).toBe('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana\r\nCATEGORIES:Work,Current\r\nEND:VCARD\r\n')
  })
  it('replaces all existing categories including folded continuations and parameters', () => {
    const raw = 'BEGIN:VCARD\nCATEGORIES:old,\n folded\n\tmore\nFN:Ana\nCATEGORIES;LANGUAGE=en:other\nNOTE:keep\n this\nEND:VCARD'
    expect(buildVcard({ ...contact('a'), raw }, ['Personal'])).toBe('BEGIN:VCARD\nFN:Ana\nNOTE:keep\n this\nCATEGORIES:Personal\nEND:VCARD')
  })
  it('removes previous categories when labels are empty', () => {
    expect(buildVcard({ ...contact('a'), raw: 'BEGIN:VCARD\nCATEGORIES:old\n folded\nEND:VCARD' }, [])).toBe('BEGIN:VCARD\nEND:VCARD')
  })
  it('escapes commas and backslashes within labels', () => {
    expect(buildVcard(contact('a'), ['Name-drop flex, Client', 'a\\b'])).toContain('CATEGORIES:Name-drop flex\\, Client,a\\\\b\r\nEND:VCARD')
  })
  it('synthesizes a CSV contact with escaped fields and default entry types', () => {
    const c = { ...contact('csv-a', 'Ana Lane'), givenName: 'Ana', familyName: 'Lane', org: 'A; B', title: 'Lead',
      phones: [{ value: '+1234' }, { value: '5678', type: 'WORK' }], emails: [{ value: 'ana@example.com' }],
      notes: 'One, two; path\\file\nNext', rev: '2026-01-01T00:00:00Z' }
    const text = buildVcard(c, ['Work'])
    expect(text).toBe('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lane;Ana;;;\r\nFN:Ana Lane\r\nORG:A\\; B\r\nTITLE:Lead\r\nTEL;TYPE=CELL:+1234\r\nTEL;TYPE=WORK:5678\r\nEMAIL;TYPE=INTERNET:ana@example.com\r\nNOTE:One\\, two\\; path\\\\file\\nNext\r\nREV:2026-01-01T00:00:00Z\r\nUID:csv-a\r\nCATEGORIES:Work\r\nEND:VCARD\r\n')
  })
  it('separates raw cards that have no trailing newline and uses decision labels', () => {
    const a = row('a', { bucket: 'work', workStatus: 'current' })
    a.contact.raw = 'BEGIN:VCARD\nFN:A\nEND:VCARD'
    const text = vcfText([a, row('b')])
    expect(text).toContain('CATEGORIES:Work,Current\nEND:VCARD\nBEGIN:VCARD')
  })
})

describe('vCard groups', () => {
  it('includes every non-Delete contact in the clean preset, including unsorted', () => {
    const clean = cleanFile([row('delete', { bucket: 'delete' }), row('work', { bucket: 'work' }), row('personal', { bucket: 'personal' }), row('undecided')])
    expect(clean.filename).toBe('contacts-clean.vcf')
    expect(clean.rows.map(({ contact }) => contact.id)).toEqual(['work', 'personal', 'undecided'])
    expect(cleanFile([row('delete', { bucket: 'delete' })]).rows).toEqual([])
  })

  it('describes files and uses taxonomy colors for labels', () => {
    const files = groupFiles([row('work', { bucket: 'work', workStatus: 'current' }), row('family', { bucket: 'personal', relation: 'family', customTags: ['lisbon'] })])
    expect(files.find((f) => f.filename === 'work-current.vcf')).toMatchObject({ description: 'Work · Current', colors: [BUCKET_META.work.color, WORK_STATUS_META.current.color] })
    expect(files.find((f) => f.filename === 'personal-family.vcf')).toMatchObject({ description: 'Personal · Family', colors: [BUCKET_META.personal.color, PERSONAL_RELATION_META.family.color] })
    expect(files.find((f) => f.filename === 'tag-lisbon.vcf')?.description).toBe('Tagged lisbon')
  })
  it('emits only nonempty files in order with correct memberships', () => {
    const rows = [
      row('delete', { bucket: 'delete' }),
      row('work', { bucket: 'work', workStatus: 'current', workTypes: ['client', 'namedrop'], customTags: ['vip'] }),
      row('personal', { bucket: 'personal', relation: 'friend', personalTypes: ['service'], customTags: ['vip'] }),
      row('undecided'),
      row('skipped', { bucket: 'work', skips: { triage: 0, work: 2, personal: 0 } }),
    ]
    const files = groupFiles(rows)
    expect(files.map((f) => f.filename)).toEqual(['all-contacts.vcf', 'delete.vcf', 'work.vcf', 'work-current.vcf', 'work-client.vcf', 'work-name-drop-flex.vcf', 'personal.vcf', 'personal-friend.vcf', 'personal-service-provider.vcf', 'unsorted.vcf', 'tag-vip.vcf'])
    const members = (filename: string) => files.find((f) => f.filename === filename)?.rows.map((r) => r.contact.id)
    expect(members('all-contacts.vcf')).toHaveLength(5)
    expect(members('work.vcf')).toEqual(['work', 'skipped'])
    expect(members('work-current.vcf')).toEqual(['work'])
    expect(members('personal-service-provider.vcf')).toEqual(['personal'])
    expect(members('unsorted.vcf')).toEqual(['undecided', 'skipped'])
    expect(members('tag-vip.vcf')).toEqual(['work', 'personal'])
    expect(groupFiles([])).toEqual([])
  })
  it('keeps distinct custom tags with colliding slugs in distinct files', () => {
    const files = groupFiles([row('a', { customTags: ['a b', 'a-b', '東京'] })])
    const tags = files.filter((f) => f.filename.startsWith('tag-'))
    expect(tags).toHaveLength(3)
    expect(new Set(tags.map((f) => f.filename)).size).toBe(3)
  })
})
