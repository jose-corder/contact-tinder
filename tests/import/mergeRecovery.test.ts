import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import { resetAll, upsertContacts } from '@/db/repo'
import { mergePair, prepareMerge, undoMerge } from '@/import/duplicates'
import { recoveryHistory, RESTORE_UNDO_MS } from '@/export/recovery'
import { contact } from '../export/fixtures'

const photo = (bytes: string) => new NodeBlob([bytes], { type: 'image/png' }) as unknown as Blob
beforeEach(resetAll)
afterEach(() => vi.restoreAllMocks())

it('round trips both photos and refuses an equal-sized, same-type photo edit (#58/#61)', async () => {
  const a = { ...contact('a'), photo: photo('AAAA') }, b = { ...contact('b'), photo: photo('BBBB') }
  await upsertContacts([a, b])
  const first = await mergePair('a', 'b')
  expect(await undoMerge(first.mergeId)).toBe(true)
  expect(await (await db.contacts.get('a'))!.photo!.text()).toBe('AAAA')
  expect(await (await db.contacts.get('b'))!.photo!.text()).toBe('BBBB')
  const second = await mergePair('a', 'b')
  await db.contacts.update('a', { photo: photo('EDIT') })
  expect(await undoMerge(second.mergeId)).toMatchObject({ conflict: true })
  expect(await (await db.contacts.get('a'))!.photo!.text()).toBe('EDIT')
})

it('refuses a stale comparison after an equal-sized photo edit (#58)', async () => {
  await upsertContacts([{ ...contact('a'), photo: photo('AAAA') }, contact('b')])
  const expected = await prepareMerge('a', 'b')
  await db.contacts.update('a', { photo: photo('EDIT') })
  await expect(mergePair('a', 'b', { expected })).rejects.toThrow('Refresh the comparison')
  expect(await db.contacts.count()).toBe(2)
  expect(await recoveryHistory()).toEqual([])
})

it('retains four distinct merge recoveries and expires only the elapsed one (#1/#56/#58)', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const ids = []
  for (let i = 0; i < 4; i++) {
    await upsertContacts([contact('a' + i), contact('b' + i)])
    ids.push((await mergePair('a' + i, 'b' + i)).mergeId)
    clock.mockReturnValue(2000 + i * 1000)
  }
  expect((await recoveryHistory()).map(e => e.id)).toEqual(ids)
  clock.mockReturnValue(1000 + RESTORE_UNDO_MS)
  expect(await undoMerge(ids[0])).toBe(false)
  expect(await db.contacts.get('a0')).toBeDefined()
  expect((await recoveryHistory()).map(e => e.id)).toEqual(ids.slice(1))
  expect(await undoMerge(ids[1])).toBe(true)
  expect(await db.contacts.get('b1')).toBeDefined()
})

it('rejects missing or identical members without writing recovery (#58)', async () => {
  await upsertContacts([contact('a')])
  await expect(prepareMerge('a', 'a')).rejects.toThrow('two different')
  await expect(mergePair('a', 'missing')).rejects.toThrow('no longer exists')
  expect(await recoveryHistory()).toEqual([])
})
