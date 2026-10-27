import { beforeEach, describe, expect, it } from 'vitest'
import { csvContact, parseCsv } from '@/import/csv'
import { contactDetails } from '@/import/details'
import { previewFiles, commitPreview } from '@/import'
import * as repo from '@/db/repo'

describe('CSV detail hardening', () => {
  it('does not use name parts, phonetics or related names as a fallback full name', () => {
    const contact = parseCsv('Nickname,Name Prefix,Phonetic First Name,Manager\'s Name,Email\nAnnie,Dr.,AH-na,Boss,ana@example.com')[0]
    expect(contact.displayName).toBe('ana@example.com')
    expect(contact.givenName).toBeUndefined()
    expect(contactDetails(contact)).toEqual(expect.arrayContaining([
      { kind: 'nickname', value: 'Annie' }, { kind: 'prefix', value: 'Dr.' },
      { kind: 'other', value: 'AH-na', label: 'Phonetic First Name' }, { kind: 'related', value: 'Boss', label: 'Manager' },
    ]))
  })

  it('avoids substring matches in unrelated columns and tracks core columns once', () => {
    const contact = csvContact({ ' Name ': 'Ada', ' Hotel ': 'Ritz', ' Smartphone Model ': 'Pixel', ' Email Consent ': 'yes',
      ' Birthday Note ': 'party', ' Job Title ': 'Engineer', ' Organization 1 - Title ': 'Lead' })!
    expect(contact).toMatchObject({ displayName: 'Ada', title: 'Lead', phones: [], emails: [] })
    expect(contact.notes).toBeUndefined()
    expect(contact.org).toBeUndefined()
    expect(contactDetails(contact).map(d => d.value)).toEqual(['Ritz', 'Pixel', 'yes', 'party', 'Engineer'])
  })

  it('recognizes renamed duplicate metadata headers instead of importing them as values', () => {
    const contact = parseCsv('Name,Phone 1 - Type,Phone 1 - Value,Phone 1 - Type,Phone 1 - Value\nAda,Home,2025550101,Work,2025550102')[0]
    expect(contact.phones.map(p => [p.value, p.type])).toEqual([['2025550101', 'Home'], ['2025550102', 'Work']])
    expect(contactDetails(contact)).toEqual([])
  })

  it('splits Google multi-values in numbered fields and parallel address components', () => {
    const contact = csvContact({ Name: 'Ada', 'Website 1 - Value': 'https://a.test ::: https://b.test',
      'Website 1 - Type': 'Home', 'Address 1 - Street': 'One ::: Two', 'Address 1 - City': 'Paris ::: 東京',
      'Address 1 - Type': 'Home ::: Work', 'Phone 1 - Value': '2025550101 ::: 2025550102',
      'Phone 1 - Type': 'Home ::: Work', Labels: '* myContacts ::: * starred ::: 友人' })!
    expect(contact.phones.map(p => p.type)).toEqual(['Home', 'Work'])
    expect(contactDetails(contact).filter(d => d.kind === 'website').map(d => d.value)).toEqual(['https://a.test', 'https://b.test'])
    expect(contactDetails(contact).filter(d => d.kind === 'address').map(d => [d.value, d.label])).toEqual([
      ['One, Paris', 'Home'], ['Two, 東京', 'Work'],
    ])
    expect(contactDetails(contact).filter(d => d.kind === 'group').map(d => d.value)).toEqual(['starred', '友人'])
  })

  it('orders Outlook streets numerically, preserves literal stars and uses formatted fallbacks', () => {
    const contact = csvContact({ Name: 'Ada', 'Business Street 3': 'Floor 3', 'Business Street 2': 'Suite 2',
      'Business Street': '* One Way', 'Business City': '* City', 'Address 1 - Formatted': '* Full address',
      'Address 1 - Type': '', 'Address 1 - Label': 'Home' })!
    expect(contactDetails(contact).filter(d => d.kind === 'address').map(d => d.value)).toEqual([
      '* Full address', '* One Way, Suite 2, Floor 3, * City',
    ])
  })

  it('deduplicates stored CSV details before first persistence', () => {
    const contact = parseCsv('Name,Labels\nAda,Friends ::: friends ::: Friends')[0]
    expect(contactDetails(contact)).toEqual([{ kind: 'group', value: 'Friends' }])
    expect((contact as { details?: unknown[] }).details).toHaveLength(1)
  })

  it('keeps duplicated Google detail columns after Papa renames their headers', () => {
    const contact = parseCsv('Name,Website 1 - Type,Website 1 - Value,Website 1 - Type,Website 1 - Value\nAda,Home,https://a.test,Work,https://b.test')[0]
    expect(contactDetails(contact)).toEqual([
      { kind: 'website', value: 'https://a.test', label: 'Home' }, { kind: 'website', value: 'https://b.test', label: 'Work' },
    ])
  })

  it('preserves Outlook fax and pager numbers with meaningful labels', () => {
    const contact = parseCsv('Name,Business Fax,Home Fax,Pager\nAda,2025550101,2025550102,2025550103')[0]
    expect(contact.phones.map(p => [p.value, p.type])).toEqual([
      ['2025550101', 'WORK,FAX'], ['2025550102', 'HOME,FAX'], ['2025550103', 'PAGER'],
    ])
    expect(contactDetails(contact)).toEqual([])
  })
})

describe('CSV repeat imports', () => {
  beforeEach(async () => { await repo.resetAll() })
  it('reports no changes on the second preview, including repeated source details', async () => {
    const file = new File(['Name,Email,Labels,Website 1 - Value\nAda,ada@example.com,Friends ::: friends,https://a.test'], 'contacts.csv')
    const first = await previewFiles([file])
    expect(first.added).toBe(1)
    await commitPreview(first)
    const second = await previewFiles([file])
    expect(second).toMatchObject({ added: 0, allAlreadyImported: true })
    expect(await commitPreview(second)).toMatchObject({ added: 0 })
    expect(await repo.allContacts()).toHaveLength(1)
  })

  it('reports no changes when duplicate phone and email cells normalize to the same key', async () => {
    const file = new File(['Name,Phone,Email\nAda,+12025550101 ::: +1 (202) 555-0101,Ada@example.com ::: ada@example.com'], 'duplicates.csv')
    const first = await previewFiles([file])
    expect(first.contacts[0].phones).toHaveLength(1)
    expect(first.contacts[0].emails).toHaveLength(1)
    await commitPreview(first)
    expect(await previewFiles([file])).toMatchObject({ added: 0, allAlreadyImported: true })
  })
})
