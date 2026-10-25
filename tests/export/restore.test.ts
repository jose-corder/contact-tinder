import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allContacts, allDecisions, allTags, dumpAll, getMeta, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { previewRestore, restoreJson, undoRestore, RESTORE_UNDO_MS } from '@/export/json'
import { contact, row } from './fixtures'
import { db } from '@/db/schema'

beforeEach(resetAll)
afterEach(() => vi.restoreAllMocks())
const backup = (contacts = [contact('new')], decisions = [row('new').decision]) => JSON.stringify({ version: 1, exportedAt: '2026-10-12T12:00:00Z', contacts, decisions })

describe('reviewed restore (#1)', () => {
  it('counts additions, contact changes, decision timestamps and removals without writes', async () => {
    await upsertContacts([contact('same'), contact('changed'), contact('decision'), contact('removed')])
    await saveDecision({ ...row('decision').decision, updatedAt: 10 })
    const before = await allContacts()
    const preview = await previewRestore(backup([contact('same'), contact('changed', 'New name'), contact('decision'), contact('new')], [{ ...row('decision').decision, updatedAt: 20 }]))
    expect(preview).toMatchObject({ exportedAt: '2026-10-12T12:00:00Z', contacts: 4, decisions: 1, added: 1, changed: 2, removed: 1,
      details: { addedIds: ['new'], changedIds: ['changed', 'decision'], removedIds: ['removed'] } })
    expect(await allContacts()).toEqual(before)
    expect(await getMeta('restoreUndo', null)).toBeNull()
  })

  it('reports decisions cleared only by replace separately and ignores property order', async () => {
    const original = contact('same')
    await upsertContacts([original])
    await saveDecision(row('same', { bucket: 'work' }).decision)
    const reordered = Object.fromEntries(Object.entries(original).reverse()) as typeof original
    expect(await previewRestore(backup([reordered], []))).toMatchObject({ changed: 0, details: { decisionRemovedIds: ['same'] } })
  })

  it('round trips contacts, photos, decisions and tags via Undo and clears the snapshot', async () => {
    await upsertContacts([{ ...contact('before'), photo: new Blob(['thumbnail'], { type: 'image/png' }) }])
    await saveDecision(row('before', { bucket: 'personal', relation: 'other', customTags: ['vip'] }).decision)
    const before = await dumpAll()
    const photos = (await allContacts())[0].photo
    await restoreJson(backup(), 'replace')
    expect(await getMeta('restoreUndo', null)).toMatchObject({ dump: { ...before, exportedAt: expect.any(String) }, at: expect.any(Number) })
    expect((await allContacts()).map((c) => c.id)).toEqual(['new'])
    expect(await undoRestore()).toBe(true)
    expect((await dumpAll()).contacts).toEqual(before.contacts)
    expect(await allDecisions()).toEqual(before.decisions)
    expect(await allTags()).toEqual(['vip'])
    expect((await allContacts())[0].photo).toEqual(photos)
    expect(await getMeta('restoreUndo', null)).toBeNull()
    expect(await undoRestore()).toBe(false)
  })

  it('expires Undo after ten minutes without changing restored data', async () => {
    const now = Date.now()
    await restoreJson(backup())
    vi.spyOn(Date, 'now').mockReturnValue(now + RESTORE_UNDO_MS + 1000)
    expect(await undoRestore()).toBe(false)
    expect((await allContacts()).map((c) => c.id)).toEqual(['new'])
    expect(await getMeta('restoreUndo', null)).toBeNull()
  })

  it('merges without removing other contacts and does not create a replace snapshot', async () => {
    await upsertContacts([contact('before')])
    await restoreJson(backup(), 'merge')
    expect(await allContacts()).toHaveLength(2)
    expect(await getMeta('restoreUndo', null)).toBeNull()
  })

  it('rolls back the snapshot and replacement together if saving fails', async () => {
    await upsertContacts([contact('before')])
    vi.spyOn(db.contacts, 'bulkPut').mockRejectedValueOnce(new Error('Storage full'))
    await expect(restoreJson(backup())).rejects.toThrow('Storage full')
    expect((await allContacts()).map((c) => c.id)).toEqual(['before'])
    expect(await getMeta('restoreUndo', null)).toBeNull()
  })

  it('rejects ambiguous decision identities and dates before mutation', async () => {
    await expect(previewRestore(backup([], [row('orphan').decision]))).rejects.toThrow('Invalid backup')
    await expect(restoreJson(backup([contact('new')], [row('new').decision, row('new').decision]))).rejects.toThrow('Invalid backup')
    await expect(previewRestore(backup().replace('2026-10-12T12:00:00Z', 'bad date'))).rejects.toThrow('Invalid backup')
    expect(await allContacts()).toEqual([])
  })
})
