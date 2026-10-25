import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta, resetAll, setMeta } from '@/db/repo'
import * as repo from '@/db/repo'
import { commitPreview, importContacts, previewContacts } from '@/import'
import { makeContact } from '@/import/contact'
import { readPossibleDuplicates, resolvePair, upsertPairs, mergePair, type DuplicatePair } from '@/import/duplicates'
import { emptyDecision } from '@/domain/types'
import { db } from '@/db/schema'

beforeEach(resetAll)
const contacts = Array.from({ length: 8 }, (_, i) => makeContact({ displayName: `Person ${i}`, phones: [{ value: '+12025550101' }], emails: [] }, 'csv')!)
describe('persistent possible duplicates (#35)', () => {
  it('stores all candidate identities beyond the preview cap, only after commit', async () => {
    const preview = await previewContacts(contacts)
    expect(preview.keptApartPairs).toHaveLength(20)
    expect(preview.possibleDuplicates).toHaveLength(28)
    expect(await getMeta('possibleDuplicates', null)).toBeNull()
    const result = await commitPreview(preview)
    expect(await getMeta<DuplicatePair[]>('possibleDuplicates', [])).toHaveLength(result.possibleDuplicates.length)
    const ids = new Set((await repo.allContacts()).map((c) => c.id))
    expect((await readPossibleDuplicates()).every(pair => ids.has(pair.a.id) && ids.has(pair.b.id))).toBe(true)
  })
  it('retains earlier unresolved pairs after an unrelated import (#54)', async () => {
    await importContacts(contacts)
    await importContacts([makeContact({ displayName: 'Unrelated', phones: [], emails: [] }, 'csv')!])
    expect(await readPossibleDuplicates()).toHaveLength(28)
  })
  it('rolls metadata back with a failed import', async () => {
    const previous = [{ ids: ['old-a', 'old-b'], reason: 'Previous import' }]
    await setMeta('possibleDuplicates', previous)
    const write = vi.spyOn(repo, 'upsertContacts').mockRejectedValueOnce(new Error('Full'))
    try { await expect(importContacts(contacts)).rejects.toThrow('Full') }
    finally { write.mockRestore() }
    expect(await getMeta('possibleDuplicates', [])).toEqual(previous)
  })
})

// #54: resolutions, stale-member pruning and explicit merge persist across imports.
it('deduplicates reversed pairs without reopening a resolution', async () => {
  await importContacts(contacts.slice(0, 2))
  const pairs = await readPossibleDuplicates()
  const resolved = resolvePair(pairs, pairs[0].id, 'kept')
  const reverse = { ...pairs[0], id: 'new-id', a: pairs[0].b, b: pairs[0].a }
  expect(upsertPairs(resolved, [reverse])).toEqual(resolved)
  expect(pairs[0].resolved).toBeUndefined()
  await setMeta('possibleDuplicates', resolved)
  await importContacts(contacts.slice(0, 2))
  expect((await readPossibleDuplicates())[0].resolved).toBe('kept')
})
it('drops deleted contacts from live results and prunes stored pairs on import', async () => {
  await importContacts(contacts.slice(0, 2))
  await repo.deleteContacts([contacts[1].id])
  expect(await readPossibleDuplicates()).toEqual([])
  await importContacts([])
  expect(await getMeta('possibleDuplicates', [])).toEqual([])
})
it('merges b into a with fields, migrated decisions and correct tag counts', async () => {
  const [a, b] = contacts
  await importContacts([a, { ...b, title: 'Designer', raw: 'BDAY:20000101' }])
  await repo.saveDecision({ ...emptyDecision(b.id), bucket: 'personal', personalTypes: ['neighbor'], customTags: ['shared'] })
  await mergePair(a.id, b.id)
  expect(await repo.allContacts()).toMatchObject([{ id: a.id, title: 'Designer', raw: 'BDAY:20000101' }])
  expect(await repo.allDecisions()).toMatchObject([{ contactId: a.id, bucket: 'personal', relation: 'other', customTags: ['shared'] }])
  expect(await db.tags.toArray()).toEqual([{ name: 'shared', count: 1 }])
  expect(await readPossibleDuplicates()).toEqual([])
})
it('rolls back contact and decision changes if a pair merge fails', async () => {
  await importContacts(contacts.slice(0, 2))
  const before = await repo.dumpAll()
  const remove = vi.spyOn(repo, 'deleteContacts').mockRejectedValueOnce(new Error('Failed'))
  try { await expect(mergePair(contacts[0].id, contacts[1].id)).rejects.toThrow('Failed') }
  finally { remove.mockRestore() }
  expect((await repo.dumpAll()).contacts).toEqual(before.contacts)
  expect(await readPossibleDuplicates()).toHaveLength(1)
})
