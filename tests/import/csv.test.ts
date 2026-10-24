import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/import/csv'

const fixture = (name: string) => readFileSync(resolve('tests/import/fixtures', `${name}.csv`), 'utf8')

describe('CSV imports', () => {
  it('supports new Google headers, middle names, every phone/email and labels', () => {
    const [contact] = parseCsv('\uFEFF' + fixture('google-new'))
    expect(contact).toMatchObject({
      displayName: 'Ada Augusta Lovelace', givenName: 'Ada', familyName: 'Lovelace',
      org: 'Analytical Engines', title: 'Mathematician', notes: 'Met in London, 2024', raw: '', source: 'csv',
      phones: [{ value: '+1 (555) 123-4567', type: 'Mobile' }, { value: '+44 20 7946 0958', type: 'Work' }],
      emails: [{ value: 'Ada@Example.com', type: 'Work' }, { value: 'ada@home.test', type: 'Home' }],
    })
  })

  it('supports old Google headers', () => {
    const [contact] = parseCsv(fixture('google-old'))
    expect(contact).toMatchObject({
      displayName: 'Grace Hopper', givenName: 'Grace', familyName: 'Hopper', org: 'Navy', title: 'Admiral',
      phones: [{ value: '202-555-0110', type: 'Mobile' }], emails: [{ value: 'grace@example.com', type: 'Work' }],
    })
  })

  it('supports Outlook phone and email columns', () => {
    const [contact] = parseCsv(fixture('outlook'))
    expect(contact).toMatchObject({ displayName: 'José García', org: 'Café', title: 'Director', notes: 'Primera línea' })
    expect(contact.emails).toHaveLength(2)
    expect(contact.phones.map((p) => p.type)).toEqual(['CELL', 'WORK', 'HOME'])
  })

  it.each(['google-new', 'google-old', 'outlook'])('keeps stable ids for %s', (name) => {
    expect(parseCsv(fixture(name))[0].id).toBe(parseCsv(fixture(name))[0].id)
  })

  it('matches unfamiliar case-insensitive headers without importing label columns', () => {
    const [contact] = parseCsv('CONTACT GIVEN,CONTACT FAMILY,COMPANY NAME,JOB ROLE,PRIMARY TEL,OTHER EMAIL,EMAIL TYPE,PERSONAL NOTE\nAna,Rivera,Studio,Designer,2025550123,ANA@EXAMPLE.COM,Work,Hello')
    expect(contact).toMatchObject({ displayName: 'Ana Rivera', org: 'Studio', title: 'Designer', notes: 'Hello', emailKeys: ['ana@example.com'] })
    expect(contact.emails).toHaveLength(1)
    expect(contact.phones).toHaveLength(1)
  })

  it('supports email-only rows and skips empty rows', () => {
    expect(parseCsv('Name,E-mail Address\n,solo@example.com\n,\n\n').map((c) => c.displayName)).toEqual(['solo@example.com'])
  })

  it('reports malformed CSV rather than quietly truncating contacts', () => {
    expect(() => parseCsv('Name,Notes\nAna,"unterminated')).toThrow('CSV')
  })

  it('does not mistake Outlook email metadata for addresses', () => {
    const [contact] = parseCsv('First Name,E-mail Address,E-mail Type,E-mail Display Name\nAda,ada@example.com,SMTP,Ada Lovelace')
    expect(contact.emails).toEqual([{ value: 'ada@example.com', type: undefined }])
  })
})
