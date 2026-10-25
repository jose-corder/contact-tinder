import { describe, expect, it } from 'vitest'
import { inTab, matchesSearch, reviewPass } from '@/features/review/model'
import { row } from '../export/fixtures'

describe('review scope', () => {
  it('includes undecided and skipped-out contacts without active work cards', () => {
    expect(inTab(row('a'), 'unsorted')).toBe(true)
    expect(inTab(row('b', { bucket: 'work' }), 'unsorted')).toBe(false)
    expect(inTab(row('c', { bucket: 'personal', skips: { triage: 0, work: 0, personal: 2 } }), 'unsorted')).toBe(true)
  })
  // Audit #6: pass selection is pure; no reset is needed to revisit a decision.
  it('chooses the first pass for mixed Unsorted without changing decisions or skips', () => {
    const rows = [row('work', { bucket: 'work', workTypes: ['vendor'], customTags: ['vip'], skips: { triage: 0, work: 2, personal: 0 } }),
      row('triage', { skips: { triage: 2, work: 0, personal: 0 } }),
      row('personal', { bucket: 'personal', personalTypes: ['neighbor'], skips: { triage: 0, work: 0, personal: 2 } })]
    const before = structuredClone(rows)
    expect(reviewPass(rows, 'unsorted')).toBe('triage')
    expect(rows).toEqual(before)
    expect(reviewPass([rows[2], rows[0]], 'unsorted')).toBe('work')
  })
  it.each(['delete', 'work', 'personal'] as const)('chooses %s without changing its classification', tab => {
    const rows = [row('A', { bucket: tab, workStatus: 'current', relation: 'family' })]
    const before = structuredClone(rows)
    expect(reviewPass(rows, tab)).toBe(tab === 'delete' ? 'triage' : tab)
    expect(rows).toEqual(before)
  })
  it('normalizes accents and phone punctuation for search', () => {
    const contact = row('María Gómez')
    contact.contact.phones = [{ value: '+1 (202) 555-0101' }]
    expect(matchesSearch(contact, 'maria gomez')).toBe(true)
    expect(matchesSearch(contact, '2025550101')).toBe(true)
    expect(matchesSearch(contact, 'no match')).toBe(false)
  })
})
