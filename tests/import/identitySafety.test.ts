import { describe, expect, it } from 'vitest'
import { makeContact } from '@/import/contact'
import { mergeContacts } from '@/import/dedupe'

const card = (displayName: string, phone = '', email = '', org?: string) => makeContact({ displayName, org,
  phones: phone ? [{ value: phone }] : [], emails: email ? [{ value: email }] : [],
}, 'csv')!

describe('safe identities', () => {
  it('keeps reused UID collisions idempotent even without shared contact keys', () => {
    const alice = { ...card('Alice'), id: 'reused' }
    const bob = { ...card('Bob'), id: 'reused' }
    const first = mergeContacts([alice, bob], [])
    expect(first.toUpsert).toHaveLength(2)
    expect(mergeContacts([bob], first.toUpsert)).toMatchObject({ added: 0, merged: 1 })
  })

  it.each(['phone', 'email'])('dedupe_keeps_distinct_people_with_shared_landline_or_family_email: %s', (kind) => {
    const phone = kind === 'phone' ? '+12025550101' : ''
    const email = kind === 'email' ? 'family@example.test' : ''
    const alice = card('Alice Smith', phone, email)
    const bob = card('Bob Smith', phone, email)
    const result = mergeContacts([alice, bob], [])
    expect(result.toUpsert).toHaveLength(2)
    expect(result.possibleDuplicates).toEqual([{ ids: [alice.id, bob.id].sort(), reason: expect.any(String) }])
    expect(mergeContacts([alice, bob], result.toUpsert)).toMatchObject({ added: 0, merged: 2 })
  })
  it('merges case/diacritic variants ignoring middle names and unnamed entries', () => {
    const rich = card('Álex John SMITH', '+12025550101')
    const result = mergeContacts([card('alex smith', '+12025550101'), card('', '+12025550101')], [rich])
    expect(result).toMatchObject({ added: 0, merged: 2, possibleDuplicates: [] })
  })
  it('does not let an unnamed bridge merge conflicting people', () => {
    const result = mergeContacts([card('Alice', '+12025550101'), card('Bob', '', 'family@example.test'), card('', '+12025550101', 'family@example.test')], [])
    expect(result.toUpsert).toHaveLength(2)
    expect(result.possibleDuplicates).toHaveLength(1)
  })
  it('dedupe_disambiguates_same_name_without_contact_keys', () => {
    const school = card('Alex Smith', '', '', 'School')
    const employer = card('Alex Smith', '', '', 'Employer')
    expect(school.id).not.toBe(employer.id)
    const result = mergeContacts([school, employer], [])
    expect(result).toMatchObject({ added: 2, merged: 0 })
    expect(mergeContacts([school, employer], result.toUpsert)).toMatchObject({ added: 0, merged: 2 })
    expect(mergeContacts([school], [card('Alex Smith', '+12025550101', '', 'Employer')]).added).toBe(1)
    expect(mergeContacts([school], [card('Alex Smith', '+12025550101', '', 'School')]).merged).toBe(1)
    expect(mergeContacts([card('Alex Smith')], [card('Alex Smith', '+12025550101', '', 'Employer')]).added).toBe(1)
  })
})
