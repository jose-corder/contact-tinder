import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { emptyDecision } from '@/domain/types'
import { prepareMerge, mergePair, undoMerge, readPossibleDuplicates, candidatePairs, proposedDecision } from '@/import/duplicates'
import { recoveryHistory } from '@/export/recovery'
import { csvText } from '@/export/csv'
import { vcfText } from '@/export/vcf'
import { makeContact } from '@/import/contact'

const a = { ...makeContact({ displayName: 'Work person', phones: [{ value: '+12025550101' }], emails: [] }, 'csv')!, id: 'a' }
const b = { ...makeContact({ displayName: 'Personal person', phones: a.phones, emails: [{ value: 'family@example.test' }] }, 'csv')!, id: 'b' }
const ad = { ...emptyDecision('a', 12), bucket: 'work' as const, workStatus: 'current' as const, workTypes: ['client' as const], customTags: ['shared', 'work'] }
const bd = { ...emptyDecision('b', 12), bucket: 'personal' as const, relation: 'family' as const, personalTypes: ['neighbor' as const], customTags: ['shared', 'home'] }
beforeEach(async () => {
  await repo.resetAll()
  await repo.upsertContacts([a, b])
  await repo.saveDecisions([ad, bd])
  await repo.setMeta('possibleDuplicates', candidatePairs([{ ids: ['a', 'b'], reason: 'shared phone' }], [a, b], 10))
})
afterEach(() => vi.restoreAllMocks())
const state = async () => ({ contacts: await repo.allContacts(), decisions: await repo.allDecisions(),
  tags: await db.tags.toArray(), meta: await db.meta.toArray() })

describe('reviewed reversible merge (#58/#61)', () => {
  it('compares actual values and both decisions without writes; conflict requires a choice', async () => {
    const before = await state()
    const preview = await prepareMerge('a', 'b')
    expect(preview).toMatchObject({ a, b, aDecision: ad, bDecision: bd, conflict: true,
      sharedValues: { phones: ['+12025550101'], emails: [] }, proposedSurvivor: { id: 'a', emails: b.emails } })
    expect(await state()).toEqual(before)
    await expect(mergePair('a', 'b')).rejects.toThrow('choose which to keep')
    expect(await state()).toEqual(before)
  })

  it.each(['a', 'b', 'union'] as const)('saves reviewed %s choice, exports it, then restores both snapshots and tag counts', async choice => {
    const before = await state()
    const preview = await prepareMerge('a', 'b')
    const proposed = proposedDecision('a', ad, bd, choice)!
    const result = await mergePair('a', 'b', { keepDecisionFrom: choice, expected: preview })
    expect(await repo.getDecision('a')).toEqual({ ...proposed, updatedAt: result.decision!.updatedAt })
    expect(await db.contacts.get('b')).toBeUndefined()
    const expectedLabels = choice === 'b' ? 'Personal,Family,Neighbor' : 'Work,Current,Client'
    expect(vcfText(await repo.allWithDecisions())).toContain('CATEGORIES:' + expectedLabels)
    expect(csvText(await repo.allWithDecisions())).toContain(choice === 'b' ? 'Personal' : 'Work')
    expect((await db.tags.toArray()).every(tag => tag.count === 1)).toBe(true)
    expect(await recoveryHistory()).toMatchObject([{ kind: 'merge', id: result.mergeId,
      snapshot: { dump: { decisions: [ad, bd] }, pairs: before.meta[0].value } }])
    expect(await undoMerge(result.mergeId)).toBe(true)
    expect(await state()).toEqual({ ...before, meta: [...before.meta, { key: 'restoreHistory', value: [] }] })
  })

  it('unions both type sets, keeps A scalar choices and unions all tags explicitly', async () => {
    const result = await mergePair('a', 'b', { keepDecisionFrom: 'union' })
    expect(result.decision).toMatchObject({ bucket: 'work', workStatus: 'current', relation: 'family',
      workTypes: ['client'], personalTypes: ['neighbor'], customTags: ['shared', 'work', 'home'] })
  })

  it.each(['contact', 'same-timestamp decision', 'recreated b', 'pair resolution'])('refuses Undo after a later %s change', async change => {
    const result = await mergePair('a', 'b', { keepDecisionFrom: 'a' })
    if (change === 'contact') await db.contacts.update('a', { title: 'Later edit' })
    if (change === 'same-timestamp decision') await repo.saveDecision({ ...result.decision!, bucket: 'delete' })
    if (change === 'recreated b') await repo.upsertContacts([b])
    if (change === 'pair resolution') {
      const c = { ...a, id: 'c' }
      await repo.upsertContacts([c])
      await repo.setMeta('possibleDuplicates', candidatePairs([{ ids: ['a', 'c'], reason: 'shared phone' }], [a, c]))
    }
    const current = await state()
    expect(await undoMerge(result.mergeId)).toMatchObject({ conflict: true })
    expect(await state()).toEqual(current)
  })

  it('rejects stale comparisons even when decision timestamps are reused', async () => {
    const expected = await prepareMerge('a', 'b')
    await repo.saveDecision({ ...ad, workTypes: ['namedrop'] })
    const current = await state()
    await expect(mergePair('a', 'b', { keepDecisionFrom: 'a', expected })).rejects.toThrow('Refresh the comparison')
    expect(await state()).toEqual(current)
  })

  it('preserves unrelated edits and restores a missing decision as missing', async () => {
    await db.decisions.delete('b')
    // Rebuild vocabulary to match the deliberately absent row.
    await db.tags.clear()
    await db.decisions.clear()
    await repo.saveDecision(ad)
    const result = await mergePair('a', 'b')
    const c = { ...a, id: 'c', displayName: 'Unrelated' }
    await repo.upsertContacts([c])
    await repo.saveDecision({ ...emptyDecision('c'), customTags: ['shared'] })
    expect(await undoMerge(result.mergeId)).toBe(true)
    expect(await db.contacts.get('c')).toEqual(c)
    expect(await db.decisions.get('b')).toBeUndefined()
    expect(await db.tags.get('shared')).toEqual({ name: 'shared', count: 2 })
  })

  it('rolls back fields, decisions, tags, pairs and snapshot if merge metadata saving fails', async () => {
    const before = await state()
    const real = repo.setMeta
    vi.spyOn(repo, 'setMeta').mockImplementation((key, value) => key === 'possibleDuplicates' ? Promise.reject(new Error('Full')) : real(key, value))
    await expect(mergePair('a', 'b', { keepDecisionFrom: 'b' })).rejects.toThrow('Full')
    expect(await state()).toEqual(before)
  })

  it('retains retryable recovery and exact data if Undo fails', async () => {
    const result = await mergePair('a', 'b', { keepDecisionFrom: 'b' })
    const before = await state()
    vi.spyOn(repo, 'saveDecisions').mockRejectedValueOnce(new Error('Full'))
    await expect(undoMerge(result.mergeId)).rejects.toThrow('Full')
    expect(await state()).toEqual(before)
    expect(await undoMerge(result.mergeId)).toBe(true)
    expect(await readPossibleDuplicates()).toHaveLength(1)
  })

  it('restores exact legacy Personal types, skips and tags without inferring Other (#61)', async () => {
    const legacy = { ...bd, relation: undefined, skips: { triage: 1, work: 0, personal: 1 } }
    await repo.saveDecision(legacy, { exact: true })
    const result = await mergePair('a', 'b', { keepDecisionFrom: 'b' })
    expect(result.decision!.relation).toBeUndefined()
    expect(await undoMerge(result.mergeId)).toBe(true)
    expect(await db.decisions.get('b')).toEqual(legacy)
  })
})
