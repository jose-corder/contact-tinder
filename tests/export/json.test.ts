// Finding #56: restore results include their recovery identity.
import { beforeEach, describe, expect, it } from 'vitest'
import { allWithDecisions, allTags, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { backupJson, restoreJson } from '@/export/json'
import { row } from './fixtures'

beforeEach(resetAll)
describe('JSON backups', () => {
  it('round trips contacts, decisions and tag vocabulary through IndexedDB', async () => {
    const r = row('ana', { bucket: 'work', workStatus: 'old', customTags: ['vip'] })
    await upsertContacts([r.contact])
    await saveDecision(r.decision)
    const backup = await backupJson()
    await resetAll()
    expect(await restoreJson(backup)).toMatchObject({ contacts: 1, decisions: 1, restoreId: expect.any(String) })
    expect(await allWithDecisions()).toEqual([r])
    expect(await allTags()).toEqual(['vip'])
  })
  it('rejects malformed JSON, versions and array shapes without modifying data', async () => {
    await upsertContacts([row('existing').contact])
    await expect(restoreJson('{')).rejects.toThrow('not valid JSON')
    for (const invalid of [
      { version: 2, exportedAt: '', contacts: [], decisions: [] },
      { version: 1, exportedAt: '', contacts: {}, decisions: [] },
      { version: 1, exportedAt: '', contacts: [{}], decisions: [] },
      { version: 1, exportedAt: '', contacts: [], decisions: [{ ...row('x').decision, workTypes: ['invalid'] }] },
    ]) await expect(restoreJson(JSON.stringify(invalid))).rejects.toThrow('Invalid backup')
    expect((await allWithDecisions()).map((r) => r.contact.id)).toEqual(['existing'])
  })
})
