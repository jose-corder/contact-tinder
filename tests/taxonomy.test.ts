import { describe, expect, it } from 'vitest'
import { applySwipe, decisionLabels, isInDeck, isUnsorted, setBucket, toggleChip, toggleCustomTag } from '@/domain/taxonomy'
import { emptyDecision } from '@/domain/types'

describe('taxonomy', () => {
  it('triage swipes set the bucket', () => {
    const d = emptyDecision('a')
    expect(applySwipe(d, 'triage', 'left').bucket).toBe('delete')
    expect(applySwipe(d, 'triage', 'right').bucket).toBe('work')
    expect(applySwipe(d, 'triage', 'up').bucket).toBe('personal')
    expect(applySwipe(d, 'triage', 'down').bucket).toBeUndefined()
    expect(applySwipe(d, 'triage', 'down').skips.triage).toBe(1)
  })

  it('work deck swipes set status; personal deck swipes set relation', () => {
    const w = applySwipe(emptyDecision('a'), 'triage', 'right')
    expect(applySwipe(w, 'work', 'left').workStatus).toBe('old')
    expect(applySwipe(w, 'work', 'right').workStatus).toBe('current')
    expect(applySwipe(w, 'work', 'up').workStatus).toBe('potential')
    const p = applySwipe(emptyDecision('b'), 'triage', 'up')
    expect(applySwipe(p, 'personal', 'left').relation).toBe('ex')
    expect(applySwipe(p, 'personal', 'right').relation).toBe('friend')
    expect(applySwipe(p, 'personal', 'up').relation).toBe('family')
  })

  it('deck membership follows the decision', () => {
    const d = emptyDecision('a')
    expect(isInDeck(undefined, 'triage')).toBe(true)
    expect(isInDeck(d, 'work')).toBe(false)
    const w = applySwipe(d, 'triage', 'right')
    expect(isInDeck(w, 'triage')).toBe(false)
    expect(isInDeck(w, 'work')).toBe(true)
    expect(isInDeck(w, 'personal')).toBe(false)
    const done = applySwipe(w, 'work', 'right')
    expect(isInDeck(done, 'work')).toBe(false)
  })

  it('two skips leave the deck as unsorted', () => {
    let d = emptyDecision('a')
    d = applySwipe(d, 'triage', 'down')
    expect(isInDeck(d, 'triage')).toBe(true)
    expect(isUnsorted(d, 'triage')).toBe(false)
    d = applySwipe(d, 'triage', 'down')
    expect(isInDeck(d, 'triage')).toBe(false)
    expect(isUnsorted(d, 'triage')).toBe(true)
  })

  it('re-bucketing clears sub-fields', () => {
    let d = applySwipe(emptyDecision('a'), 'triage', 'right')
    d = applySwipe(d, 'work', 'right')
    d = toggleChip(d, 'work', 'client')
    expect(d.workTypes).toEqual(['client'])
    const p = setBucket(d, 'personal')
    expect(p.workStatus).toBeUndefined()
    expect(p.workTypes).toEqual([])
  })

  it('chips toggle and tags normalize', () => {
    let d = applySwipe(emptyDecision('a'), 'triage', 'up')
    d = toggleChip(d, 'personal', 'neighbor')
    d = toggleChip(d, 'personal', 'neighbor')
    expect(d.personalTypes).toEqual([])
    d = toggleCustomTag(d, '  Padel  Group ')
    expect(d.customTags).toEqual(['padel group'])
    d = applySwipe(d, 'personal', 'right')
    expect(decisionLabels(d)).toEqual(['Personal', 'Friend', 'padel group'])
  })
})
