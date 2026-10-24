import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { importContacts } from '@/import'
import { makeContact } from '@/import/contact'
import { emptyDecision } from '@/domain/types'

beforeEach(repo.resetAll)
const a = makeContact({ displayName: 'Same Person', phones: [{ value: '+12025550101' }], emails: [] }, 'csv')!
const b = makeContact({ displayName: 'Same Person', phones: [], emails: [{ value: 'same@example.test' }] }, 'csv')!
a.importedAt = 1
b.importedAt = 2
const bridge = makeContact({ displayName: 'Same Person', phones: a.phones, emails: b.emails }, 'csv')!

describe('decision consolidation', () => {
  it.each(['absent', 'undefined', 'conflict'])('bridge_merge_preserves_or_resolves_both_decisions: %s', async (mode) => {
    await repo.upsertContacts([a, b])
    if (mode !== 'absent') await repo.saveDecision({ ...emptyDecision(a.id), bucket: mode === 'conflict' ? 'work' : undefined, customTags: ['survivor', 'shared'] })
    await repo.saveDecision({ ...emptyDecision(b.id), bucket: 'personal', relation: 'family', customTags: ['other', 'shared'] })
    const result = await importContacts([bridge])
    expect(result.decisionsMigrated).toBe(1)
    expect(await repo.allContacts()).toHaveLength(1)
    const decisions = await repo.allDecisions()
    expect(decisions).toHaveLength(1)
    expect(decisions[0]).toMatchObject({ contactId: a.id, bucket: mode === 'conflict' ? 'work' : 'personal' })
    expect(new Set(decisions[0].customTags)).toEqual(new Set(mode === 'absent' ? ['other', 'shared'] : ['survivor', 'other', 'shared']))
    expect((await db.tags.toArray()).every((tag) => tag.count === 1)).toBe(true)
  })
  it('rolls contact, decision and vocabulary migration back together', async () => {
    await repo.upsertContacts([a, b])
    await repo.saveDecision({ ...emptyDecision(b.id), customTags: ['saved'] })
    const before = await repo.dumpAll()
    const remove = vi.spyOn(repo, 'deleteContacts').mockRejectedValueOnce(new Error('Deletion failed'))
    try { await expect(importContacts([bridge])).rejects.toThrow('Deletion failed') } finally { remove.mockRestore() }
    expect(await repo.allContacts()).toEqual(before.contacts)
    expect(await repo.allDecisions()).toEqual(before.decisions)
    expect(await db.tags.toArray()).toEqual([{ name: 'saved', count: 1 }])
  })
})
