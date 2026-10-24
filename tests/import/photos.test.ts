import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_PHOTO_BYTES, resizePhoto } from '@/import/photos'
import { parseVcf } from '@/import/vcard'
import { parseVcfChunks } from '@/import/parseChunks'

afterEach(() => vi.unstubAllGlobals())

describe('import photos', () => {
  it('skips over 2 MB without changing raw or dropping the card', async () => {
    const raw = `BEGIN:VCARD\nFN:Photo\nPHOTO;ENCODING=b:${'AAAA'.repeat(Math.ceil((MAX_PHOTO_BYTES + 1) / 3))}\nEND:VCARD`
    const { contacts } = await parseVcfChunks(raw)
    expect(contacts[0].photo).toBeUndefined()
    expect(contacts[0].raw).toBe(raw)
    expect(await resizePhoto(new Blob([new Uint8Array(MAX_PHOTO_BYTES + 1)]))).toBeUndefined()
  })

  it.each(['createImageBitmap', 'OffscreenCanvas'])('keeps the blob when %s is unavailable', async (name) => {
    vi.stubGlobal(name, undefined)
    const blob = new Blob(['photo'])
    expect(await resizePhoto(blob)).toBe(blob)
  })

  it('downscales to 512px, preserves proportions, and closes the bitmap', async () => {
    const bitmap = { width: 2048, height: 1024, close: vi.fn() }
    const thumbnail = new Blob(['thumbnail'], { type: 'image/jpeg' })
    const draw = vi.fn()
    const convert = vi.fn().mockResolvedValue(thumbnail)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    vi.stubGlobal('OffscreenCanvas', class {
      width: number
      height: number
      constructor(width: number, height: number) { this.width = width; this.height = height }
      getContext() { return { drawImage: draw } }
      convertToBlob = convert
    })
    const raw = 'BEGIN:VCARD\nFN:Photo\nPHOTO:data:image/png;base64,aGVsbG8=\nEND:VCARD'
    const { contacts } = await parseVcfChunks(raw)
    expect(draw).toHaveBeenCalledWith(bitmap, 0, 0, 512, 256)
    expect(contacts[0].photo).toBe(thumbnail)
    expect(contacts[0].raw).toBe(raw)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('keeps small photos and falls back when decoding or canvas conversion fails', async () => {
    const blob = new Blob(['photo'])
    const bitmap = { width: 32, height: 64, close: vi.fn() }
    const decode = vi.fn().mockResolvedValueOnce(bitmap).mockRejectedValueOnce(new Error('Bad photo'))
    vi.stubGlobal('createImageBitmap', decode)
    vi.stubGlobal('OffscreenCanvas', class { constructor() { throw new Error('Unsupported') } })
    expect(await resizePhoto(blob)).toBe(blob)
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(await resizePhoto(blob)).toBe(blob)
    decode.mockResolvedValue({ ...bitmap, width: 1024 })
    expect(await resizePhoto(blob)).toBe(blob)
    expect(parseVcf('BEGIN:VCARD\nFN:Valid\nPHOTO;ENCODING=b:%%%\nEND:VCARD')[0].displayName).toBe('Valid')
  })
})
