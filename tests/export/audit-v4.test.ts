import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import { allWithDecisions, counts, deckContacts, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { backupJson, restoreJson, undoRestore } from '@/export/json'
import { recoveryHistory, RESTORE_UNDO_MS } from '@/export/recovery'
import { mergePair, undoMerge } from '@/import/duplicates'
import { groupFiles, vcfText } from '@/export/vcf'
import { csvText } from '@/export/csv'
import { WORK_TYPE_META } from '@/domain/taxonomy'
import { contact, row } from './fixtures'

beforeEach(resetAll)
afterEach(() => vi.restoreAllMocks())
const backup = JSON.stringify({ version: 1, exportedAt: '2026-10-12T12:00:00Z', contacts: [contact('new')], decisions: [] })

describe('exact snapshot recovery (#61)', () => {
  it.each(['replace', 'merge'] as const)('%s restore Undo returns legacy types, skips, tags, membership and exports exactly', async mode => {
    const legacy = row('legacy', { bucket: 'personal', personalTypes: ['neighbor'],
      customTags: ['saved'], skips: { triage: 1, work: 0, personal: 1 }, updatedAt: 12 })
    await upsertContacts([legacy.contact])
    await saveDecision(legacy.decision, { exact: true })
    const before = { counts: await counts(), deck: await deckContacts('personal'), csv: csvText([legacy]), vcf: vcfText([legacy]) }
    const { restoreId } = await restoreJson(backup, mode)
    expect(await undoRestore(restoreId)).toBe(true)
    expect(await db.decisions.get('legacy')).toEqual(legacy.decision)
    expect((await db.decisions.get('legacy'))!.relation).toBeUndefined()
    expect(await counts()).toEqual(before.counts)
    expect(await deckContacts('personal')).toEqual(before.deck)
    const rows = await allWithDecisions()
    expect(csvText(rows)).toBe(before.csv); expect(vcfText(rows)).toBe(before.vcf)
    expect(groupFiles(rows).some(f => f.filename === 'personal-other.vcf')).toBe(false)
    expect(await db.tags.toArray()).toEqual([{ name: 'saved', count: 1 }])
    await saveDecision(legacy.decision)
    expect((await db.decisions.get('legacy'))!.relation).toBe('other')
  })

  it('JSON backup restore preserves an absent legacy relation too', async () => {
    const legacy = row('legacy', { bucket: 'personal', personalTypes: ['neighbor'] })
    await upsertContacts([legacy.contact]); await saveDecision(legacy.decision, { exact: true })
    const text = await backupJson()
    await resetAll(); await restoreJson(text)
    expect(await allWithDecisions()).toEqual([legacy])
  })
})

describe('recovery retention (#1/#56)', () => {
  it('prunes only expired entries, including when a reviewed rollback creates another recovery', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const expired = await restoreJson(backup)
    clock.mockReturnValue(1000 + RESTORE_UNDO_MS)
    const ids = []
    for (let i = 0; i < 12; i++) ids.push((await restoreJson(backup)).restoreId)
    expect((await recoveryHistory()).map(e => e.id)).toEqual(ids)
    expect(await undoRestore(expired.restoreId)).toBe(false)
    const result = await undoRestore(ids[0])
    if (typeof result !== 'object') throw new Error('Expected review')
    expect(await undoRestore(ids[0], result.revision)).toBe(true)
    expect(await recoveryHistory()).toHaveLength(12)
    for (const id of ids.slice(1)) expect((await recoveryHistory()).some(e => e.id === id)).toBe(true)
  })

  it('interleaves restore and pair merge recoveries without clearing either kind', async () => {
    const restore = await restoreJson(backup)
    await upsertContacts([contact('a'), contact('b')])
    const merge = await mergePair('a', 'b')
    expect((await recoveryHistory()).map(e => e.kind)).toEqual(['restore', 'merge'])
    const next = await restoreJson(backup, 'merge')
    expect(await undoRestore(merge.mergeId)).toBe(false)
    expect(await undoMerge(next.restoreId)).toBe(false)
    expect(await undoRestore(next.restoreId)).toBe(true)
    expect(await undoMerge(merge.mergeId)).toBe(true)
    expect((await recoveryHistory()).map(e => e.id)).toEqual([restore.restoreId])
  })
})

it('uses Notable contact in list descriptions while keeping CATEGORIES, CSV and filename unchanged (#41)', () => {
  const namedrop = row('notable', { bucket: 'work', workTypes: ['namedrop'] })
  expect(WORK_TYPE_META.namedrop).toEqual({ label: 'Name-drop flex', uiLabel: 'Notable contact' })
  expect(groupFiles([namedrop]).find(f => f.filename === 'work-name-drop-flex.vcf')?.description).toBe('Work · Notable contact')
  expect(vcfText([namedrop])).toContain('CATEGORIES:Work,Name-drop flex')
  expect(csvText([namedrop])).toContain('Name-drop flex')
  expect(csvText([namedrop])).not.toContain('Notable contact')
})
