import { describe, expect, it } from 'vitest'
import { emailKey, keysFor, mergeContacts, phoneKey } from '@/import/dedupe'
import { makeContact } from '@/import/contact'

const contact = (name: string, phones: string[] = [], emails: string[] = []) => makeContact({
  displayName: name, phones: phones.map((value) => ({ value })), emails: emails.map((value) => ({ value })),
}, 'vcf')!

describe('dedupe', () => {
  it('normalizes parseable numbers even if the exchange is not valid', () => {
    expect(phoneKey('+1 (555) 123-4567')).toBe('+15551234567')
    expect(phoneKey('555.123.4567')).toBe('+15551234567')
    expect(phoneKey('020 7946 0958', 'GB')).toBe('+442079460958')
    expect(phoneKey('123')).toBeUndefined()
    expect(phoneKey('not a number')).toBeUndefined()
    expect(phoneKey('12345678901234567890')).toBe('12345678901234567890')
  })

  it('normalizes email and unique keys', () => {
    expect(emailKey(' ADA@Example.COM ')).toBe('ada@example.com')
    expect(emailKey('not-email')).toBeUndefined()
    expect(keysFor([{ value: '555.123.4567' }, { value: '+1 (555) 123-4567' }], [
      { value: ' A@B.COM ' }, { value: 'a@b.com' }, { value: '' },
    ])).toEqual({ phoneKeys: ['+15551234567'], emailKeys: ['a@b.com'] })
  })

  it('merges formatted phones while retaining the existing identity and nonempty fields', () => {
    const existing = { ...contact('Ada', ['+1 (555) 123-4567']), org: 'Original', raw: 'original card' }
    const incoming = { ...contact('Ada L.', ['555.123.4567', '2025550123'], ['ada@example.com']),
      title: 'Engineer', notes: 'Hello', photo: new Blob(['photo']), rev: '2024-01-01', org: 'Replacement' }
    const result = mergeContacts([incoming], [existing])
    expect(result).toMatchObject({ added: 0, merged: 1 })
    expect(result.toUpsert[0]).toMatchObject({ id: existing.id, displayName: 'Ada', org: 'Original', title: 'Engineer', notes: 'Hello', raw: 'original card' })
    expect(result.toUpsert[0].photo).toBe(incoming.photo)
    expect(result.toUpsert[0].phones).toHaveLength(2)
    expect(result.toUpsert[0].emails).toHaveLength(1)
    expect(existing.phones).toHaveLength(1)
  })

  it('collapses a transitive incoming chain even when the bridge is last', () => {
    const first = contact('A', ['2025550101'])
    const second = contact('B', [], ['b@example.com'])
    const bridge = contact('C', ['2025550101'], ['b@example.com'])
    const result = mergeContacts([first, second, bridge], [])
    expect(result).toMatchObject({ added: 1, merged: 2 })
    expect(result.toUpsert).toHaveLength(1)
    expect(result.toUpsert[0].id).toBe(first.id)
  })

  it('retains existing identity when a batch contains an earlier new duplicate', () => {
    const existing = contact('Existing', [], ['person@example.com'])
    const first = contact('First', ['2025550101'])
    const bridge = contact('Bridge', ['2025550101'], ['PERSON@example.com'])
    const result = mergeContacts([first, bridge], [existing])
    expect(result).toMatchObject({ added: 0, merged: 2 })
    expect(result.toUpsert[0].id).toBe(existing.id)
  })

  it('matches stable IDs without keys, fills empty names and does not write untouched contacts', () => {
    const first = { ...contact('Known'), displayName: '' }
    const incoming = { ...contact('Known'), raw: 'card', org: 'Company' }
    expect(mergeContacts([incoming], [first, contact('Other')])).toMatchObject({
      added: 0, merged: 1, toUpsert: [{ displayName: 'Known', raw: 'card', org: 'Company' }],
    })
  })
})
