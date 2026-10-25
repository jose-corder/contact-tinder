import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import { allContacts, allDecisions, dumpAll, getMeta, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { dbRevision, previewRestore, restoreJson, undoRestore } from '@/export/json'
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
    await restoreJson(backup())
    await upsertContacts([{ ...contact('later'), photo: new Blob(['later-photo']) }])
    await saveDecision(row('restored', { bucket: 'personal', relation: 'other' }).decision)
    const newer = await dumpAll()
    const photo = (await db.contacts.get('later'))?.photo
    const result = await undoRestore()
    expect(result).toMatchObject({ conflict: true, preview: { added: 1, removed: 2 } })
    expect((await allContacts()).map((c) => c.id)).toEqual(['later', 'restored'])
    if (typeof result !== 'object') throw new Error('Expected conflict')
    expect(await undoRestore(result.revision)).toBe(true)
    expect((await allContacts()).map((c) => c.id)).toEqual(['before'])
    expect(await getMeta('restoreUndo', null)).toMatchObject({ dump: { contacts: newer.contacts }, revisionAfterRestore: await dbRevision() })
    expect(await undoRestore()).toBe(true)
    expect((await dumpAll()).contacts).toEqual(newer.contacts)
    expect(await allDecisions()).toEqual(newer.decisions)
    expect((await db.contacts.get('later'))?.photo).toEqual(photo)
  })

  it('requires fresh review if data changes after the conflict preview', async () => {
    await restoreJson(backup())
    await upsertContacts([contact('later')])
    const result = await undoRestore()
    if (typeof result !== 'object') throw new Error('Expected conflict')
    await upsertContacts([contact('even-later')])
    expect(await undoRestore(result.revision)).toMatchObject({ conflict: true, preview: { removed: 3 } })
    expect(await allContacts()).toHaveLength(3)
  })

  it('keeps both live data and the original snapshot if a reviewed rollback fails', async () => {
    await restoreJson(backup())
    await upsertContacts([contact('later')])
    const result = await undoRestore()
    if (typeof result !== 'object') throw new Error('Expected conflict')
    const snapshot = await getMeta('restoreUndo', null)
    const write = vi.spyOn(db.contacts, 'bulkPut').mockRejectedValueOnce(new Error('Storage failed'))
    try { await expect(undoRestore(result.revision)).rejects.toThrow('Storage failed') }
    finally { write.mockRestore() }
    expect(await allContacts()).toHaveLength(2)
    expect(await getMeta('restoreUndo', null)).toEqual(snapshot)
  })
})
