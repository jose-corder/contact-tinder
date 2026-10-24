import { afterEach, describe, expect, it, vi } from 'vitest'
import { storageAfterImport } from '@/import/storage'
import { importContacts, previewFiles } from '@/import'
import { makeContact } from '@/import/contact'
import { resetAll } from '@/db/repo'

afterEach(() => vi.unstubAllGlobals())
describe('durable storage after import', () => {
  it('requests persistence once after success and reports usage above 80 percent', async () => {
    await resetAll()
    const persist = vi.fn().mockRejectedValue(new Error('Unavailable'))
    const estimate = vi.fn().mockResolvedValue({ usage: 81, quota: 100 })
    vi.stubGlobal('navigator', { storage: { persist, estimate }, language: 'en-US' })
    const file = new File(['BEGIN:VCARD\nFN:Storage\nEND:VCARD'], 'storage.vcf')
    await previewFiles([file])
    expect(persist).not.toHaveBeenCalled()
    const contact = makeContact({ displayName: 'Storage', phones: [], emails: [] }, 'csv')!
    const result = await importContacts([contact])
    expect(result.storageNote).toContain('Device storage is getting full')
    await importContacts([contact])
    expect(persist).toHaveBeenCalledOnce()
    estimate.mockResolvedValue({ usage: 80, quota: 100 })
    expect(await storageAfterImport()).toBeUndefined()
    estimate.mockRejectedValue(new Error('Unavailable'))
    expect(await storageAfterImport()).toBeUndefined()
  })
  it('supports browsers without storage APIs', async () => {
    vi.stubGlobal('navigator', {})
    expect(await storageAfterImport()).toBeUndefined()
  })
})
