import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMeta, resetAll, setMeta } from '@/db/repo'
import * as repo from '@/db/repo'
import { commitPreview, importContacts, previewContacts } from '@/import'
import { makeContact } from '@/import/contact'
import type { PossibleDuplicate } from '@/import/dedupe'

beforeEach(resetAll)
const contacts = Array.from({ length: 8 }, (_, i) => makeContact({ displayName: `Person ${i}`, phones: [{ value: '+12025550101' }], emails: [] }, 'csv')!)
describe('persistent possible duplicates (#35)', () => {
  it('stores all candidate identities beyond the preview cap, only after commit', async () => {
    const preview = await previewContacts(contacts)
    expect(preview.keptApartPairs).toHaveLength(20)
    expect(preview.possibleDuplicates).toHaveLength(28)
    expect(await getMeta('possibleDuplicates', null)).toBeNull()
    const result = await commitPreview(preview)
    expect(await getMeta<PossibleDuplicate[]>('possibleDuplicates', [])).toEqual(result.possibleDuplicates)
    const ids = new Set((await repo.allContacts()).map((c) => c.id))
    expect(result.possibleDuplicates.every((pair) => pair.ids.every((id) => ids.has(id)))).toBe(true)
  })
  it('replaces the latest-import set, including an empty set', async () => {
    await importContacts(contacts)
    await importContacts([makeContact({ displayName: 'Unrelated', phones: [], emails: [] }, 'csv')!])
    expect(await getMeta('possibleDuplicates', null)).toEqual([])
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
