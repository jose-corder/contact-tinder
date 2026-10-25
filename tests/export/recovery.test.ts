// Finding #56: recovery targets immutable restore IDs and preserves merge snapshots.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import { allContacts, allDecisions, dumpAll, getMeta, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { dbRevision, previewRestore, restoreJson, undoRestore } from '@/export/json'
import { restoreHistory } from '@/export/json'
import { contact, row } from './fixtures'

beforeEach(resetAll)
const backup = () => JSON.stringify({ version: 1, exportedAt: '2026-10-12T12:00:00Z', contacts: [contact('restored')], decisions: [row('restored').decision] })

describe('safe restore recovery (#1/#52)', () => {
  it('compares decision contents even when timestamps match', async () => {
    await upsertContacts([contact('restored')])
    await saveDecision(row('restored', { bucket: 'delete' }).decision)
    expect(await previewRestore(backup())).toMatchObject({ changed: 1, details: { changedIds: ['restored'] } })
  })

  it('detects same-timestamp decisions, contact enrichment and imports in the revision', async () => {
    await restoreJson(backup())
    const initial = await dbRevision()
    await saveDecision(row('restored', { bucket: 'delete' }).decision)
    const edited = await dbRevision()
    expect(edited).not.toBe(initial)
    await upsertContacts([contact('restored', 'Enriched')])
    expect(await dbRevision()).not.toBe(edited)
  })

  it('reviews intervening work, preserves it before rollback, and allows a second Undo', async () => {
    await upsertContacts([contact('before')])
    const { restoreId } = await restoreJson(backup())
    await upsertContacts([{ ...contact('later'), photo: new Blob(['later-photo']) }])
    await saveDecision(row('restored', { bucket: 'personal', relation: 'other' }).decision)
    const newer = await dumpAll()
    const photo = (await db.contacts.get('later'))?.photo
    const result = await undoRestore(restoreId)
    expect(result).toMatchObject({ conflict: true, preview: { added: 1, removed: 2 } })
    expect((await allContacts()).map((c) => c.id)).toEqual(['later', 'restored'])
    if (typeof result !== 'object') throw new Error('Expected conflict')
    expect(await undoRestore(restoreId, result.revision)).toBe(true)
    expect((await allContacts()).map((c) => c.id)).toEqual(['before'])
    const recovery = (await restoreHistory()).at(-1)!
    expect(recovery).toMatchObject({ snapshot: { dump: { contacts: newer.contacts } }, revisionAfter: await dbRevision() })
    expect(recovery.id).not.toBe(restoreId)
    expect(await undoRestore(recovery.id)).toBe(true)
    expect((await dumpAll()).contacts).toEqual(newer.contacts)
    expect(await allDecisions()).toEqual(newer.decisions)
    expect((await db.contacts.get('later'))?.photo).toEqual(photo)
  })

  it('requires fresh review if data changes after the conflict preview', async () => {
    const { restoreId } = await restoreJson(backup())
    await upsertContacts([contact('later')])
    const result = await undoRestore(restoreId)
    if (typeof result !== 'object') throw new Error('Expected conflict')
    await upsertContacts([contact('even-later')])
    expect(await undoRestore(restoreId, result.revision)).toMatchObject({ conflict: true, preview: { removed: 3 } })
    expect(await allContacts()).toHaveLength(3)
  })

  it('keeps both live data and the original snapshot if a reviewed rollback fails', async () => {
    const { restoreId } = await restoreJson(backup())
    await upsertContacts([contact('later')])
    const result = await undoRestore(restoreId)
    if (typeof result !== 'object') throw new Error('Expected conflict')
    const snapshot = await getMeta('restoreHistory', [])
    const write = vi.spyOn(db.contacts, 'bulkPut').mockRejectedValueOnce(new Error('Storage failed'))
    try { await expect(undoRestore(restoreId, result.revision)).rejects.toThrow('Storage failed') }
    finally { write.mockRestore() }
    expect(await allContacts()).toHaveLength(2)
    expect(await getMeta('restoreHistory', [])).toEqual(snapshot)
  })
})

// #56: an earlier control must never act on a later restore's snapshot.
it('retains separate restore identities and conflicts on undoing an older restore', async () => {
  await upsertContacts([contact('original')])
  const first = await restoreJson(backup())
  const second = await restoreJson(backup().replaceAll('restored', 'second'))
  const entries = await restoreHistory()
  expect(entries.map(entry => entry.id)).toEqual([first.restoreId, second.restoreId])
  expect(entries[0].snapshot.dump.contacts.map(c => c.id)).toEqual(['original'])
  expect(entries[1].snapshot.dump.contacts.map(c => c.id)).toEqual(['restored'])
  expect(await undoRestore(first.restoreId)).toMatchObject({ conflict: true, restoreId: first.restoreId })
  expect((await allContacts()).map(c => c.id)).toEqual(['second'])
  expect(await undoRestore(second.restoreId)).toBe(true)
  expect((await restoreHistory()).map(entry => entry.id)).toEqual([first.restoreId])
})
it('retains only the last three entries and never redirects an evicted ID', async () => {
  const ids: string[] = []
  for (let i = 0; i < 4; i++) ids.push((await restoreJson(backup())).restoreId)
  expect(new Set(ids).size).toBe(4)
  expect((await restoreHistory()).map(entry => entry.id)).toEqual(ids.slice(1))
  expect(await undoRestore(ids[0])).toBe(false)
})
it('merge Undo restores overwritten data, removed photos and decisions, preserving older entries', async () => {
  const first = await restoreJson(backup())
  await upsertContacts([{ ...contact('restored', 'Before merge'), photo: new Blob(['photo']) }, contact('local')])
  await saveDecision(row('restored', { bucket: 'work', customTags: ['local'] }).decision)
  const before = await dumpAll()
  const photo = (await db.contacts.get('restored'))!.photo
  const merged = await restoreJson(backup(), 'merge')
  expect(await undoRestore(merged.restoreId)).toBe(true)
  expect((await dumpAll()).contacts).toEqual(before.contacts)
  expect(await allDecisions()).toEqual(before.decisions)
  expect((await db.contacts.get('restored'))!.photo).toEqual(photo)
  expect((await restoreHistory()).map(entry => entry.id)).toEqual([first.restoreId])
})

it('requires review for an older restore even when the later backup has identical contents (#56)', async () => {
  const first = await restoreJson(backup())
  await restoreJson(backup())
  const approval = await undoRestore(first.restoreId)
  expect(approval).toMatchObject({ conflict: true })
  if (typeof approval !== 'object') throw new Error('Expected conflict')
  await restoreJson(backup())
  expect(await undoRestore(first.restoreId, approval.revision)).toMatchObject({ conflict: true })
})
