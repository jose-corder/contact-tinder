import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { importContacts } from '@/import'
import { makeContact } from '@/import/contact'
import { candidatePairs, mergePair, readPossibleDuplicates, savePairResolution, undoMerge } from '@/import/duplicates'
import { pairKey } from '@/import/remapPairs'
import { recoveryHistory } from '@/export/recovery'

const card = (id: string, phone = '', email = '') => ({ ...makeContact({ displayName: id,
  phones: phone ? [{ value: phone }] : [], emails: email ? [{ value: email }] : [] }, 'csv')!, id })
const contacts = [card('a', '+12025550101'), card('b', '+12025550101', 'shared@example.test'),
  card('c', '', 'shared@example.test'), card('d', '+12025550102'), card('e', '+12025550102')]
const pair = (a: string, b: string, reason: 'shared phone' | 'shared email' | 'same name' = 'shared phone') =>
  candidatePairs([{ ids: [a, b], reason }], contacts, 100)[0]
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts(contacts) })
afterEach(() => vi.restoreAllMocks())

describe('candidate edge remapping (#59)', () => {
  it('keeps B/C as unresolved A/C with recomputed email evidence through reload and unrelated import', async () => {
    await repo.setMeta('possibleDuplicates', [pair('a', 'b'), pair('b', 'c', 'shared phone')])
    const { mergeId } = await mergePair('a', 'b')
    expect(await readPossibleDuplicates()).toMatchObject([{ id: pairKey('a', 'c'), a: { id: 'a' }, b: { id: 'c' }, reason: 'shared email' }])
    db.close(); await db.open()
    await importContacts([card('unrelated')])
    const unresolved = (await readPossibleDuplicates()).filter(p => !p.resolved)
    expect(unresolved).toHaveLength(1)
    await savePairResolution(unresolved[0].id, 'kept')
    expect((await readPossibleDuplicates()).filter(p => !p.resolved)).toHaveLength(0)
    expect(await undoMerge(mergeId)).toMatchObject({ conflict: true })
  })

  it('rewrites either endpoint, drops self/resolved pairs, canonicalizes duplicates and preserves unrelated resolutions', async () => {
    const unrelated = { ...pair('d', 'e'), resolved: 'dismissed' as const }
    await repo.setMeta('possibleDuplicates', [pair('b', 'a'), pair('c', 'b', 'same name'),
      pair('b', 'c', 'same name'), { ...pair('a', 'b'), a: pair('a', 'b').b }, unrelated])
    await mergePair('a', 'b')
    const stored = await repo.getMeta('possibleDuplicates', [])
    expect(stored).toHaveLength(2)
    expect(stored).toContainEqual(unrelated)
    expect(stored).toContainEqual(expect.objectContaining({ id: pairKey('a', 'c'), reason: 'shared email' }))
    expect((await readPossibleDuplicates()).some(p => p.a.id === 'b' || p.b.id === 'b')).toBe(false)
  })

  it.each([true, false])('unresolved B/C evidence wins over dismissed A/C regardless of ordering: %s', async reverse => {
    const edges = [{ ...pair('a', 'c', 'same name'), resolved: 'dismissed' as const }, pair('b', 'c', 'shared email')]
    await repo.setMeta('possibleDuplicates', [pair('a', 'b'), ...(reverse ? edges.reverse() : edges)])
    await mergePair('a', 'b')
    expect(await readPossibleDuplicates()).toEqual([expect.objectContaining({ id: pairKey('a', 'c'), reason: 'shared email' })])
    expect((await readPossibleDuplicates())[0].resolved).toBeUndefined()
    await importContacts([card('unrelated')])
    expect((await readPossibleDuplicates())[0].resolved).toBeUndefined()
  })

  it('preserves a remapped resolution when no unresolved evidence competes', async () => {
    await repo.setMeta('possibleDuplicates', [pair('a', 'b'), { ...pair('b', 'c'), resolved: 'kept' }])
    await mergePair('a', 'b')
    expect(await readPossibleDuplicates()).toMatchObject([{ id: pairKey('a', 'c'), resolved: 'kept', reason: 'shared email' }])
  })

  it('does not silently prune unrelated stored metadata with a missing member during Merge', async () => {
    const stale = { ...pair('d', 'e'), b: { id: 'missing', displayName: 'Missing' }, resolved: 'dismissed' }
    await repo.setMeta('possibleDuplicates', [pair('a', 'b'), stale])
    await mergePair('a', 'b')
    expect(await repo.getMeta('possibleDuplicates', [])).toEqual([stale])
  })

  it('Undo restores unresolved edges and keeps later unrelated resolutions (#58/#59)', async () => {
    const original = [pair('a', 'b'), pair('b', 'c', 'shared email'), pair('d', 'e')]
    await repo.setMeta('possibleDuplicates', original)
    const { mergeId } = await mergePair('a', 'b')
    await savePairResolution(pairKey('d', 'e'), 'dismissed')
    expect(await undoMerge(mergeId)).toBe(true)
    const pairs = await readPossibleDuplicates()
    expect(pairs).toContainEqual(original[0]); expect(pairs).toContainEqual(original[1])
    expect(pairs).toContainEqual({ ...original[2], resolved: 'dismissed' })
  })

  it('rolls back candidates and recovery together when contact removal fails', async () => {
    const original = [pair('a', 'b'), pair('b', 'c', 'shared email')]
    await repo.setMeta('possibleDuplicates', original)
    vi.spyOn(repo, 'deleteContacts').mockRejectedValueOnce(new Error('Cannot remove'))
    await expect(mergePair('a', 'b')).rejects.toThrow('Cannot remove')
    expect(await repo.allContacts()).toEqual(contacts)
    expect(await repo.getMeta('possibleDuplicates', [])).toEqual(original)
    expect(await recoveryHistory()).toEqual([])
  })
})
