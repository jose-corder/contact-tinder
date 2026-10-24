import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareVcards } from '@/export/prepare'
import { groupFiles, cleanFile } from '@/export/vcf'
import { row } from './fixtures'

const readFile = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.readAsText(file)
})
afterEach(() => vi.unstubAllGlobals())

describe('lazy export preparation', () => {
  it('export_preparation_is_bounded_and_share_failure_offers_download: selected files and yielding', async () => {
    let reads = 0
    const rows = Array.from({ length: 5000 }, (_, i) => {
      const item = row(String(i), { bucket: 'work', customTags: ['large'] })
      Object.defineProperty(item.contact, 'raw', { get: () => { reads++; return 'BEGIN:VCARD\nFN:Photo\nPHOTO;ENCODING=b:' + 'a'.repeat(1024) + '\nEND:VCARD' } })
      return item
    })
    const groups = groupFiles(rows)
    const clean = cleanFile(rows)
    expect(reads).toBe(0)
    expect(groups.length).toBeGreaterThan(1)
    const yieldTask = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('scheduler', { yield: yieldTask })
    const files = await prepareVcards([clean], true)
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('contacts-clean.vcf')
    expect(reads).toBeGreaterThan(0)
    expect(yieldTask).toHaveBeenCalledTimes(25)
    const text = await readFile(files[0])
    expect(text.match(/BEGIN:VCARD/g)).toHaveLength(5000)
    expect(text).not.toContain('END:VCARDBEGIN')
    yieldTask.mockClear()
    await prepareVcards([{ ...clean, rows: rows.slice(0, 1) }, { ...clean, rows: rows.slice(1, 2) }], true)
    expect(yieldTask).toHaveBeenCalledTimes(3)
  })
})
