import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allContacts, resetAll } from '@/db/repo'
import * as repo from '@/db/repo'
import { commitPreview, importFiles, previewFiles } from '@/import'
import { parseCsvChunks, parseVcfChunks } from '@/import/parseChunks'
import { parseVcf } from '@/import/vcard'

beforeEach(resetAll)

describe('chunked import and preview', () => {
  it('imports 5,000 synthetic cards in under 7 seconds, yields, dedupes and saves batches of 500', async () => {
    // Finding #1: duplicates in this performance fixture also share a name.
    const text = Array.from({ length: 5000 }, (_, i) => `BEGIN:VCARD\r\nVERSION:3.0\r\nUID:${i}\r\nFN:Person ${i % 4500}\r\nEMAIL:person${i % 4500}@example.com\r\nNOTE:${'x'.repeat(1000)}\r\nEND:VCARD\r\n`).join('')
    const progress = vi.fn()
    const writes = vi.spyOn(repo, 'upsertContacts')
    let ticks = 0
    const timer = setInterval(() => ticks++, 0)
    const start = performance.now()
    try {
      const result = await importFiles([new File([text], 'large.vcf')], progress)
      const elapsed = performance.now() - start
      expect(result).toMatchObject({ added: 4500, merged: 500, total: 5000, errors: [] })
      expect(elapsed).toBeLessThan(7000)
      expect(ticks).toBeGreaterThan(10)
      expect(writes.mock.calls.map(([batch]) => batch.length)).toEqual(Array(9).fill(500))
      expect(await allContacts()).toHaveLength(4500)
      expect(new Set(progress.mock.calls.map(([p]) => p.phase))).toEqual(new Set(['reading', 'parsing', 'deduping', 'saving']))
      expect(progress.mock.calls.filter(([p]) => p.phase === 'parsing').length).toBeGreaterThanOrEqual(25)
      console.info(`5,000-card import: ${Math.round(elapsed)} ms`)
    } finally { clearInterval(timer); writes.mockRestore() }
  }, 10000)

  it('counts duplicates and photos without saving, then recognizes an unchanged re-import', async () => {
    const raw = 'BEGIN:VCARD\r\nFN:Ada\r\nORG:Studio\r\nEMAIL:ada@example.com\r\nPHOTO;ENCODING=b:aGk=\r\nEND:VCARD\r\n'
    const file = new File([raw + raw], 'icloud.vcf')
    const preview = await previewFiles([file])
    expect(preview).toMatchObject({ total: 2, added: 1, merged: 1, photos: 2, allAlreadyImported: false })
    expect(preview.contacts[0].raw).toBe(raw)
    expect(await allContacts()).toEqual([])
    await commitPreview(preview)
    expect(await previewFiles([file])).toMatchObject({ added: 0, merged: 2, allAlreadyImported: true })
  })

  it('does not call an enriching import already imported', async () => {
    await importFiles([new File(['BEGIN:VCARD\nFN:Ada\nEND:VCARD'], 'a.vcf')])
    const preview = await previewFiles([new File(['BEGIN:VCARD\nFN:Ada\nORG:Studio\nEND:VCARD'], 'a.vcf')])
    expect(preview.allAlreadyImported).toBe(false)
    expect(preview.merged).toBe(1)
  })

  it('recovers complete cards after broken boundaries and reports skips', async () => {
    const raw = 'BEGIN:VCARD\nFN:Broken\nBEGIN:VCARD\nFN:Good\nEND:VCARD\nBEGIN:VCARD\nNOTE:Empty\nEND:VCARD\nBEGIN:VCARD\nFN:Truncated'
    const result = await parseVcfChunks(raw)
    expect(result.skipped).toBe(3)
    expect(result.contacts.map((c) => c.displayName)).toEqual(['Good'])
    expect(result.contacts[0].raw).toBe('BEGIN:VCARD\nFN:Good\nEND:VCARD\n')
  })

  it('pauses CSV with quoted multiline fields and keeps good rows around malformed rows', async () => {
    const progress = vi.fn()
    const text = 'Name,Notes\r\n' + Array.from({ length: 601 }, (_, i) => `Person ${i},"First\r\nSecond"`).join('\r\n')
    const parsed = await parseCsvChunks(text, progress)
    expect(parsed.contacts).toHaveLength(601)
    expect(parsed.contacts[200].notes).toBe('First\r\nSecond')
    expect(progress.mock.calls.map(([p]) => p.parsed)).toEqual([200, 400, 600, 601])
    const partial = await importFiles([new File(['Name,Notes\nGood,Okay\nBad,Too,many\nAlso good,Fine\nBroken,"unclosed'], 'partial.csv')])
    expect(partial).toMatchObject({ added: 2, total: 2 })
    expect(partial.errors[0]).toContain('2 unreadable rows skipped')
  })

  it.each(['', 'unreadable bytes', 'Name,Notes\nBad,"unclosed'])('returns a calm error for an unreadable CSV', async (content) => {
    // Finding #41: recovery uses plain contact-file terminology.
    const preview = await previewFiles([new File([content], 'export.csv')])
    expect(preview.total).toBe(0)
    expect(preview.errors).toEqual(['Nothing we could read in `export.csv`. Try exporting a contact file (.vcf) instead.'])
  })

  it('rolls back earlier batches when a later batch fails', async () => {
    const contacts = parseVcf(Array.from({ length: 501 }, (_, i) => `BEGIN:VCARD\nFN:Person ${i}\nEND:VCARD\n`).join(''))
    const real = repo.upsertContacts
    const writes = vi.spyOn(repo, 'upsertContacts').mockImplementationOnce(real).mockRejectedValueOnce(new Error('Quota exceeded'))
    try {
      const { importContacts } = await import('@/import')
      await expect(importContacts(contacts)).rejects.toThrow('Quota exceeded')
      expect(await allContacts()).toEqual([])
    } finally { writes.mockRestore() }
  })
})
