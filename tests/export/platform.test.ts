import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportPlatform, platformHint } from '@/export/platform'
import { canShareFiles, fileAction } from '@/export/share'

afterEach(() => vi.unstubAllGlobals())

describe('phone export guidance', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari', 0, 'iphone'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'iphone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari', 5, 'iphone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari', 0, 'desktop'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/140', 5, 'android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140', 0, 'desktop'],
  ] as const)('detects %s', (ua, touch, expected) => expect(exportPlatform(ua, touch)).toBe(expected))

  it('gives an actionable hint for each platform', () => {
    // Findings #8/#26: place exact iPhone next steps alongside clean export.
    expect(platformHint('iphone')).toContain('Share → Save to Files → open the .vcf → Add All Contacts')
    expect(platformHint('iphone')).toContain('AirDrop to a Mac')
    expect(platformHint('android')).toBe('Download → open the file → Contacts imports it.')
    expect(platformHint('desktop')).toBe('Download, then import at contacts.google.com or icloud.com.')
  })

  it('checks actual file sets and handles throwing/absent sharing APIs', () => {
    const one = new File(['card'], 'one.vcf', { type: 'text/vcard' })
    const two = new File(['card'], 'two.vcf', { type: 'text/vcard' })
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: ({ files }: ShareData) => files?.length === 1 })
    expect(fileAction([one])).toBe('Share')
    expect(fileAction([one, two])).toBe('Download')
    expect(canShareFiles([])).toBe(false)
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => { throw new Error('Unsupported') } })
    expect(fileAction([one])).toBe('Download')
    vi.stubGlobal('navigator', {})
    expect(fileAction([one])).toBe('Download')
  })
})
