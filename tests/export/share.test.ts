import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadText, shareOrDownload } from '@/export/share'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
describe('share or download', () => {
  it('shares supported files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share })
    const files = [new File(['card'], 'contacts.vcf', { type: 'text/vcard' })]
    expect(await shareOrDownload(files, 'Contacts')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ files, title: 'Contacts' })
  })
  it('downloads fallback files and revokes temporary URLs', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {})
    const create = vi.fn().mockReturnValue('blob:test')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download) })
    expect(await shareOrDownload([new File(['one'], 'one.vcf'), new File(['two'], 'two.vcf')])).toBe('downloaded')
    downloadText('backup.json', '{}', 'application/json')
    expect(names).toEqual(['one.vcf', 'two.vcf', 'backup.json'])
    expect(create.mock.calls[2][0].type).toBe('application/json')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledTimes(3)
  })
  it('does not download when a user cancels native sharing', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) })
    await expect(shareOrDownload([new File([''], 'a.vcf')])).rejects.toMatchObject({ name: 'AbortError' })
  })
})
