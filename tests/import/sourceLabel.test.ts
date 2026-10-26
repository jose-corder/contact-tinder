import { describe, expect, it } from 'vitest'
import { sourceLabel } from '@/import/sourceLabel'
import { makeContact } from '@/import/contact'
import type { ContactSource } from '@/domain/types'
const contact = makeContact({ displayName: 'Test', phones: [], emails: [] }, 'vcf')!
describe('honest source labels (#15)', () => {
  it.each([['vcf', 'vCard file'], ['csv', 'CSV file'], ['picker', 'Phone contacts'], ['demo', 'Demo']] as const)('labels %s', (source: ContactSource, label) => {
    expect(sourceLabel({ ...contact, source })).toBe(label)
  })
  it.each([['-//Apple Inc.//iOS 17.5//EN', 'Apple Contacts'], ['-//Google Inc.//Google Contacts//', 'Google Contacts'], ['Microsoft Outlook 16', 'Outlook'], ['Unknown', 'vCard file']])('reads PRODID %s', (prodId, expected) => {
    expect(sourceLabel({ ...contact, raw: `BEGIN:VCARD\r\nPRODID:${prodId}\r\nEND:VCARD` })).toBe(expected)
  })
  it('unfolds provider evidence and ignores provider names in unrelated fields', () => {
    expect(sourceLabel({ ...contact, raw: 'PRODID:-//Apple \r\n Inc.//iOS//EN' })).toBe('Apple Contacts')
    expect(sourceLabel({ ...contact, raw: 'NOTE:Apple Inc. Outlook Google Contacts' })).toBe('vCard file')
    expect(sourceLabel({ ...contact, source: 'demo', raw: 'PRODID:Microsoft Outlook' })).toBe('Demo')
  })
})
