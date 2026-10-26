import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { importContacts, importFiles, previewFiles, commitPreview } from '@/import'
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

  it('previews and imports the 40-card fixture with its two intentional duplicates', async () => {
    const text = readFileSync(resolve('tests/import/fixtures/sample-40.vcf'), 'utf8')
    const file = new File([text], 'sample-40.vcf', { type: 'text/vcard' })
    const preview = await previewFiles([file])
    expect(preview).toMatchObject({ added: 38, merged: 2, total: 40, errors: [] })
    expect(preview.contacts).toHaveLength(40)
    expect(await repo.allContacts()).toHaveLength(0)
    expect(await commitPreview(preview)).toEqual({ added: 38, merged: 2, total: 40, errors: [], possibleDuplicates: [], decisionsMigrated: 0 })
    const stored = await repo.allContacts()
    expect(stored).toHaveLength(38)
    expect(stored.every((c) => c.source === 'vcf')).toBe(true)
    const repeated = await previewFiles([file])
    expect(repeated).toMatchObject({ added: 0, merged: 40, allAlreadyImported: true })
    expect(await commitPreview(repeated)).toMatchObject({ added: 0, merged: 40, total: 40 })
    expect(await repo.allContacts()).toHaveLength(38)
  })

  it('reports unreadable contact files without saving contacts', async () => {
    const file = new File([], 'unreadable.vcf')
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockRejectedValue(new Error('Read failed')) })
    const preview = await previewFiles([file])
    expect(preview).toMatchObject({ total: 0, contacts: [], errors: [
      'Nothing we could read in `unreadable.vcf`. Try exporting a contact file (.vcf) instead.',
    ] })
    expect(await commitPreview(preview)).toMatchObject({ added: 0, total: 0, errors: preview.errors })
    expect(await repo.allContacts()).toHaveLength(0)
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
