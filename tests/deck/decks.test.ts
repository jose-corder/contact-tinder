import { describe, expect, it } from 'vitest'
import { enqueueSkipped, progressOf, reinsertFront, removeTop } from '@/domain/decks'

describe('deck queues', () => {
  it('removes the top and appends a skipped item without mutating the queue', () => {
    const queue = Object.freeze(['a', 'b', 'c'])
    expect(enqueueSkipped(removeTop(queue), 'a')).toEqual(['b', 'c', 'a'])
    expect(queue).toEqual(['a', 'b', 'c'])
  })
  it('restores a card to the front and handles empty queues', () => {
    expect(reinsertFront(['b'], 'a')).toEqual(['a', 'b'])
    expect(removeTop([])).toEqual([])
    expect(enqueueSkipped([], 'a')).toEqual(['a'])
  })
  it('calculates bounded progress including empty and completed decks', () => {
    expect(progressOf(1, 3)).toBe(0.25)
    expect(progressOf(0, 0)).toBe(0)
    expect(progressOf(3, 0)).toBe(1)
    expect(progressOf(-1, 2)).toBe(0)
    expect(progressOf(2, -1)).toBe(1)
  })
})
