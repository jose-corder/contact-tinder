import { describe, expect, it, vi } from 'vitest'
import { fileBytes, zipFiles } from '@/export/zip'
import { xlsxFile } from '@/export/xlsx'

function checksum(bytes: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}

describe('large ZIP archives', () => {
  it('reads large payloads in bounded chunks', async () => {
    const file = new File(['文'.repeat(1024 * 1024)], 'large.txt')
    const fullRead = vi.fn().mockRejectedValue(new Error('Do not buffer the whole file'))
    Object.defineProperty(file, 'arrayBuffer', { value: fullRead })
    const archive = await zipFiles([file])
    expect(fullRead).not.toHaveBeenCalled()
    expect(archive.size).toBeGreaterThan(file.size)
  })
  it('rejects ZIP32 overflow before reading payload bytes', async () => {
    const file = new File([], 'huge.txt')
    Object.defineProperty(file, 'size', { value: 0xffffffff })
    const read = vi.fn().mockRejectedValue(new Error('Already tried to allocate 4 GiB'))
    Object.defineProperty(file, 'arrayBuffer', { value: read })
    await expect(zipFiles([file])).rejects.toThrow(/ZIP32/)
    expect(read).not.toHaveBeenCalled()
  })
  it('validates CRCs, sizes, offsets, XML and deterministic bytes for a multi-megabyte workbook', async () => {
    const table = { headers: ['Name', 'Notes'], rows: Array.from({ length: 10001 }, (_, i) => [`José 😀 ${i}`, '中文 שלום '.repeat(40)]) }
    const first = await fileBytes(await xlsxFile(table))
    const second = await fileBytes(await xlsxFile(table))
    expect(first.byteLength).toBeGreaterThan(3 * 1024 * 1024)
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
    const view = new DataView(first.buffer)
    const short = (at: number) => view.getUint16(at, true)
    const long = (at: number) => view.getUint32(at, true)
    const end = first.length - 22
    expect(long(end)).toBe(0x06054b50)
    expect(short(end + 8)).toBe(6)
    expect(short(end + 10)).toBe(6)
    let at = long(end + 16), next = 0
    expect(at + long(end + 12)).toBe(end)
    for (let i = 0; i < 6; i++) {
      expect(long(at)).toBe(0x02014b50)
      const offset = long(at + 42), size = long(at + 24), nameLength = short(at + 28)
      expect(offset).toBe(next)
      expect(long(offset)).toBe(0x04034b50)
      expect(short(at + 8)).toBe(0x0800)
      expect(short(at + 10)).toBe(0)
      expect(long(at + 20)).toBe(size)
      expect(long(offset + 18)).toBe(size)
      expect(long(offset + 22)).toBe(size)
      expect(short(offset + 26)).toBe(nameLength)
      const decode = (start: number, length: number) => new TextDecoder().decode(first.subarray(start, start + length))
      const name = decode(at + 46, nameLength)
      expect(decode(offset + 30, nameLength)).toBe(name)
      const start = offset + 30 + nameLength + short(offset + 28)
      const payload = first.subarray(start, start + size)
      expect(checksum(payload), name).toBe(long(at + 16))
      expect(long(offset + 14)).toBe(long(at + 16))
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(payload), 'application/xml')
      expect(doc.querySelector('parsererror'), name).toBeNull()
      if (name === 'xl/worksheets/sheet1.xml') {
        expect(doc.querySelectorAll('row')).toHaveLength(10002)
        expect(doc.querySelector('autoFilter')!.getAttribute('ref')).toBe('A1:B10002')
      }
      if (name === 'xl/workbook.xml') expect(doc.querySelector('definedName')!.textContent).toBe('Contacts!$A$1:$B$10002')
      next = start + size
      at += 46 + nameLength + short(at + 30) + short(at + 32)
    }
    expect(next).toBe(long(end + 16))
    expect(at).toBe(end)
  })
})
