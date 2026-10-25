import { describe, expect, it } from 'vitest'
import { makeContact } from '@/import/contact'
import { mergeContacts } from '@/import/dedupe'
import { describeMergePair } from '@/import/mergeSummary'
const card = (displayName: string, phone = '+12025550101') => makeContact({ displayName, phones: [{ value: phone }], emails: [] }, 'vcf')!
describe('inspectable merges (#35)', () => {
  it('explains accented variants and separates household phone owners', () => {
    const a = card('Maria Gomez'), b = card('María Gómez')
    expect(describeMergePair(a, b)).toEqual({ names: ['Maria Gomez', 'María Gómez'], reason: 'same phone' })
    const result = mergeContacts([a, b, card('Alice Smith'), card('Bob Smith')], [])
    expect(result.mergePairs).toEqual([{ names: ['Maria Gomez', 'María Gómez'], reason: 'same phone' }])
    expect(result.keptApartPairs).toContainEqual({ names: ['Alice Smith', 'Bob Smith'], reason: 'shared phone, different names' })
  })
  it('caps each explanation group at twenty pairs', () => {
    const result = mergeContacts(Array.from({ length: 50 }, () => card('Same')), [])
    expect(result.mergePairs).toHaveLength(20)
    expect(mergeContacts(Array.from({ length: 30 }, (_, i) => card(`Person ${i}`)), []).keptApartPairs).toHaveLength(20)
  })
  it('does not show untouched existing pairs as incoming merges', () => {
    expect(mergeContacts([], [card('Same'), card('Same')]).mergePairs).toEqual([])
  })
})
