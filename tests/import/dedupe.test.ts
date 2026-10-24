import { describe, expect, it } from 'vitest'
import { emailKey, keysFor, mergeContacts, phoneKey } from '@/import/dedupe'
import { makeContact } from '@/import/contact'

const contact = (name: string, phones: string[] = [], emails: string[] = []) => makeContact({
  displayName: name, phones: phones.map((value) => ({ value })), emails: emails.map((value) => ({ value })),
}, 'vcf')!

describe('dedupe', () => {
  it('matches normalized email even when names and phones differ', () => {
    expect(mergeContacts([contact('New', ['2025550102'], [' ADA@EXAMPLE.COM '])], [contact('Ada', ['2025550101'], ['ada@example.com'])])).toMatchObject({ added: 0, merged: 1 })
  })

  it.each([true, false])('merges identical names when one side has no phone/email, incoming bare: %s', (bareIncoming) => {
    const bare = contact('Ada Lovelace')
    const rich = contact('Ada Lovelace', ['2025550101'], ['ada@example.com'])
    const result = mergeContacts([bareIncoming ? bare : rich], [bareIncoming ? rich : bare])
    expect(result).toMatchObject({ added: 0, merged: 1 })
    expect(result.toUpsert[0].phones).toHaveLength(1)
  })

  it('does not merge namesakes when both have contact details', () => {
    expect(mergeContacts([contact('Ada', [], ['ada@one.com'])], [contact('Ada', [], ['ada@two.com'])]).added).toBe(1)
  })

  it('blocks same-domain conflicting primary emails despite a shared secondary email or UID', () => {
    const a = contact('Ada', [], ['ada@example.com', 'office@shared.test'])
    const b = contact('Bob', [], ['bob@example.com', 'office@shared.test'])
    const result = mergeContacts([{ ...b, id: a.id }], [a])
    expect(result).toMatchObject({ added: 1, merged: 0, superseded: [] })
    expect(result.toUpsert[0].id).not.toBe(a.id)
  })

  it('allows conflicting primary emails when normalized phones match', () => {
    const a = contact('Ada', ['2025550101'], ['ada@example.com'])
    const b = contact('Bob', ['+1 202 555 0101'], ['bob@example.com'])
    expect(mergeContacts([b], [a])).toMatchObject({ added: 0, merged: 1 })
  })

  it('does not let a name-only bridge join conflicting people', () => {
    const a = contact('Same', [], ['ada@example.com'])
    const b = contact('Same', [], ['bob@example.com'])
    expect(mergeContacts([a, contact('Same'), b], []).toUpsert).toHaveLength(2)
  })

  it('does not bypass primary-email conflicts through an indirect phone bridge', () => {
    const a = contact('A', ['2025550101'], ['a@example.com'])
    const b = contact('B', ['2025550101', '2025550102'], ['b@example.com'])
    const c = contact('C', ['2025550102'], ['c@example.com'])
    expect(mergeContacts([a, b, c], []).toUpsert).toHaveLength(2)
  })

  it('keeps exact raw from the richer card in either order', () => {
    const a = { ...contact('Ada', [], ['ada@example.com']), raw: 'BEGIN:VCARD\r\nFN:Ada\r\nEND:VCARD\r\n' }
    const b = { ...a, org: 'Studio', photo: new Blob(['photo']), raw: 'BEGIN:VCARD\r\nFN:Ada\r\nORG:Studio\r\nPHOTO;ENCODING=b:aGk=\r\nEND:VCARD\r\n' }
    expect(mergeContacts([b], [a]).toUpsert[0].raw).toBe(b.raw)
    expect(mergeContacts([a], [b]).toUpsert[0].raw).toBe(b.raw)
  })
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
