import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { importContacts, importDemo, importFiles } from '@/import'
import { parseVcf } from '@/import/vcard'
import { makeContact } from '@/import/contact'

const google = readFileSync(resolve('tests/import/fixtures/google.vcf'), 'utf8')

describe('import persistence', () => {
  beforeEach(async () => { await repo.resetAll() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('re-imports idempotently with fake-indexeddb and preserves decisions', async () => {
    const contacts = parseVcf(google)
    expect(await importContacts(contacts)).toEqual({ added: 2, merged: 0, total: 2, errors: [], possibleDuplicates: [], decisionsMigrated: 0 })
    const decision = { ...await repo.getDecision(contacts[0].id), bucket: 'work' as const }
    await repo.saveDecision(decision)
    expect(await importContacts(parseVcf(google))).toEqual({ added: 0, merged: 2, total: 2, errors: [], possibleDuplicates: [], decisionsMigrated: 0 })
    expect(await repo.allContacts()).toHaveLength(2)
    expect(await repo.getDecision(contacts[0].id)).toEqual(decision)
  })

  it('keeps UID-only and name-only re-imports idempotent', async () => {
    const contacts = parseVcf('BEGIN:VCARD\nFN:Name Only\nEND:VCARD\nBEGIN:VCARD\nFN:UID Person\nUID:123\nEND:VCARD')
    await importContacts(contacts)
    expect(await importContacts(contacts)).toMatchObject({ added: 0, merged: 2 })
    expect(await repo.allContacts()).toHaveLength(2)
  })

  it('imports multiple files, detects content, and reports individual failures', async () => {
    const files = [
      new File([google], 'export.VCARD'),
      new File(['\uFEFF' + google], 'unknown.txt'),
      new File(['Name,E-mail Address\nNew Person,new@example.com'], 'contacts.csv'),
      new File(['BEGIN:VCARD\nEND:VCARD'], 'empty.vcf'),
      new File(['Name,Notes\nBad,"unclosed'], 'bad.csv'),
    ]
    const result = await importFiles(files)
    expect(result).toMatchObject({ added: 3, merged: 2, total: 5 })
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('empty.vcf')
    expect(result.errors[1]).toContain('bad.csv')
    expect(await repo.allContacts()).toHaveLength(3)
    expect(await importFiles([files[0]])).toMatchObject({ added: 0, merged: 2 })
  })

  it('uses file extension before sniffing and reads Blob.arrayBuffer where available', async () => {
    const file = new File([], 'contacts.csv')
    // Finding #13: decode original bytes, not Blob.text().
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockResolvedValue(new TextEncoder().encode('Name,Notes\nBEGIN:VCARD,Just a name').buffer) })
    expect(await importFiles([file])).toMatchObject({ added: 1 })
    expect((await repo.allContacts())[0].source).toBe('csv')
  })

  it('imports the actual 40-card demo with its two intentional duplicates', async () => {
    const demo = readFileSync(resolve('public/demo.vcf'), 'utf8')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => demo })
    vi.stubGlobal('fetch', fetchMock)
    expect(await importDemo()).toEqual({ added: 38, merged: 2, total: 40, errors: [], possibleDuplicates: [], decisionsMigrated: 0 })
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}demo.vcf`)
    expect((await repo.allContacts()).every((c) => c.source === 'demo')).toBe(true)
    expect(await importDemo()).toMatchObject({ added: 0, merged: 40 })
  })

  it('reports failed demo fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(importDemo()).rejects.toThrow('demo could not be loaded')
  })

  it('serializes concurrent imports', async () => {
    const results = await Promise.all([importContacts(parseVcf(google)), importContacts(parseVcf(google))])
    expect(results.reduce((sum, r) => sum + r.added, 0)).toBe(2)
    expect(await repo.allContacts()).toHaveLength(2)
  })

  it('consolidates existing records bridged by an import', async () => {
    const a = makeContact({ displayName: 'Same' /* Finding #1: a bridge needs matching identity. */, phones: [{ value: '2025550101' }], emails: [] }, 'csv')!
    const b = makeContact({ displayName: 'Same', phones: [], emails: [{ value: 'b@example.com' }] }, 'csv')!
    a.importedAt = 1
    b.importedAt = 2
    await repo.upsertContacts([a, b])
    const decision = { ...await repo.getDecision(a.id), bucket: 'personal' as const }
    await repo.saveDecision(decision)
    const bridge = makeContact({ displayName: 'Same', phones: a.phones, emails: b.emails }, 'csv')!
    expect(await importContacts([bridge])).toMatchObject({ added: 0, merged: 1 })
    expect(await repo.allContacts()).toHaveLength(1)
    expect(await repo.getDecision(a.id)).toEqual(decision)
  })

  it('rolls back on storage failures', async () => {
    vi.spyOn(repo, 'upsertContacts').mockRejectedValueOnce(new Error('Storage full'))
    await expect(importContacts(parseVcf(google))).rejects.toThrow('Storage full')
    expect(await db.contacts.count()).toBe(0)
  })
})
