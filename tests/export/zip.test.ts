import { describe, expect, it } from 'vitest'
import { crc32, fileBytes, zipFiles } from '@/export/zip'

// #25: an independent test reader follows the central directory to every local record.
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const short = (at: number) => view.getUint16(at, true)
  const long = (at: number) => view.getUint32(at, true)
  const end = bytes.length - 22
  expect(long(end)).toBe(0x06054b50)
  expect(short(end + 8)).toBe(short(end + 10))
  const directory = long(end + 16)
  expect(directory + long(end + 12)).toBe(end)
  let at = directory, nextLocal = 0
  const entries: Array<{ name: string; bytes: Uint8Array }> = []
  for (let i = 0; i < short(end + 10); i++) {
    expect(long(at)).toBe(0x02014b50)
    expect(short(at + 10)).toBe(0)
    expect(short(at + 8)).toBe(0x0800)
    const size = long(at + 24), nameSize = short(at + 28), local = long(at + 42)
    expect(local).toBe(nextLocal)
    expect(long(local)).toBe(0x04034b50)
    expect(short(local + 8)).toBe(0)
    expect(long(local + 18)).toBe(size)
    expect(long(local + 22)).toBe(size)
    expect(long(local + 14)).toBe(long(at + 16))
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameSize))
    expect(new TextDecoder().decode(bytes.slice(local + 30, local + 30 + short(local + 26)))).toBe(name)
    const dataStart = local + 30 + short(local + 26) + short(local + 28)
    entries.push({ name, bytes: bytes.slice(dataStart, dataStart + size) })
    nextLocal = dataStart + size
    at += 46 + nameSize + short(at + 30) + short(at + 32)
  }
  expect(nextLocal).toBe(directory)
  expect(at).toBe(end)
  return entries
}

describe('STORE ZIP export (#25)', () => {
  it('uses the standard CRC32 check vector', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
  it('round trips Unicode filenames, binary bytes and empty files with correct offsets', async () => {
    const files = [new File(['BEGIN:VCARD\r\nFN:José\r\nEND:VCARD'], 'José.vcf'),
      new File([Uint8Array.of(0, 255, 17, 128, 10)], 'binary.dat'), new File([], 'empty.txt')]
    const zip = await zipFiles(files)
    expect(zip.name).toBe('contacts-export.zip')
    expect(zip.type).toBe('application/zip')
    const entries = readZip(await fileBytes(zip))
    expect(entries.map(entry => entry.name)).toEqual(files.map(file => file.name))
    for (let i = 0; i < files.length; i++) expect(entries[i].bytes).toEqual(await fileBytes(files[i]))
  })
  it('supports empty archives and rejects duplicate filenames', async () => {
    expect(readZip(await fileBytes(await zipFiles([])))).toEqual([])
    await expect(zipFiles([new File([], 'a'), new File([], 'a')])).rejects.toThrow('Duplicate ZIP filename')
  })
})
