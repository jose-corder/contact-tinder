import { describe, expect, it } from 'vitest'
import { inTab, resetForReview } from '@/features/review/model'
import { row } from '../export/fixtures'

describe('review pass resets', () => {
  it('includes undecided and skipped-out contacts without including active work cards', () => {
    expect(inTab(row('a'), 'unsorted')).toBe(true)
    expect(inTab(row('b', { bucket: 'work' }), 'unsorted')).toBe(false)
    expect(inTab(row('c', { bucket: 'personal', skips: { triage: 0, work: 0, personal: 2 } }), 'unsorted')).toBe(true)
  })
  it('resets each unsorted contact in its own pass without losing chips or tags', () => {
    const rows = [
      row('work', { bucket: 'work', workTypes: ['vendor'], customTags: ['vip'], skips: { triage: 0, work: 2, personal: 0 } }),
      row('triage', { skips: { triage: 2, work: 0, personal: 0 } }),
      row('personal', { bucket: 'personal', personalTypes: ['neighbor'], skips: { triage: 0, work: 0, personal: 2 } }),
    ]
    const result = resetForReview(rows, 'unsorted')
    // Finding #21: pass order wins over row/alphabetical order.
    expect(result.pass).toBe('triage')
    expect(result.decisions.map((d) => d.skips)).toEqual(Array(3).fill({ triage: 0, work: 0, personal: 0 }))
    expect(result.decisions[0].workTypes).toEqual(['vendor'])
    expect(result.decisions[0].customTags).toEqual(['vip'])
    expect(rows[0].decision.skips.work).toBe(2)
  })
  it('clears the relevant decision for delete, work and personal lists', () => {
    expect(resetForReview([row('d', { bucket: 'delete', skips: { triage: 2, work: 0, personal: 0 } })], 'delete').decisions[0].bucket).toBeUndefined()
    expect(resetForReview([row('w', { bucket: 'work', workStatus: 'old' })], 'work').decisions[0].workStatus).toBeUndefined()
    expect(resetForReview([row('p', { bucket: 'personal', relation: 'family' })], 'personal').decisions[0].relation).toBeUndefined()
  })
  it('review_reswipe_scopes_real_decks_and_orders_mixed_passes: Work precedes Personal', () => {
    const personal = row('Amy', { bucket: 'personal', skips: { triage: 0, work: 0, personal: 2 } })
    const work = row('Zoe', { bucket: 'work', skips: { triage: 0, work: 2, personal: 0 } })
    expect(resetForReview([personal, work], 'unsorted').pass).toBe('work')
    expect(resetForReview([work, personal], 'unsorted').pass).toBe('work')
  })
})
