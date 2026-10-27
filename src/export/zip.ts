/** #25: minimal ZIP32 STORE archive. UTF-8 names, no dependencies or compression. */
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
export async function fileBytes(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
  return new Uint8Array(buffer)
}
function header(size: number) {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  return { bytes, short: (at: number, value: number) => view.setUint16(at, value, true),
    long: (at: number, value: number) => view.setUint32(at, value, true) }
}

export async function zipFiles(files: File[], archiveName = 'contacts-export.zip', type = 'application/zip'): Promise<File> {
  if (files.length > 0xffff) throw new Error('Too many files for a ZIP archive.')
  const local: BlobPart[] = [], central: BlobPart[] = []
  const names = new Set<string>()
  let offset = 0, directorySize = 0
  for (const file of files) {
    if (names.has(file.name)) throw new Error('Duplicate ZIP filename: ' + file.name)
    names.add(file.name)
    const name = new TextEncoder().encode(file.name)
    if (name.length > 0xffff) throw new Error('ZIP filename is too long.')
    const bytes = await fileBytes(file)
    const size = bytes.byteLength
    if (offset + 30 + name.length + size > 0xffffffff) throw new Error('Export exceeds the ZIP32 size limit.')
    const crc = crc32(bytes)
    const h = header(30)
    h.long(0, 0x04034b50); h.short(4, 20); h.short(6, 0x0800)
    h.short(8, 0); h.short(12, 33) // STORE; 1 Jan 1980 (deterministic)
    h.long(14, crc); h.long(18, size); h.long(22, size); h.short(26, name.length)
    local.push(h.bytes, name, bytes)
    const c = header(46)
    c.long(0, 0x02014b50); c.short(4, 20); c.short(6, 20); c.short(8, 0x0800)
    c.short(10, 0); c.short(14, 33)
    c.long(16, crc); c.long(20, size); c.long(24, size); c.short(28, name.length)
    c.long(42, offset)
    central.push(c.bytes, name)
    offset += h.bytes.length + name.length + size
    directorySize += c.bytes.length + name.length
  }
  if (offset + directorySize + 22 > 0xffffffff) throw new Error('Export exceeds the ZIP32 size limit.')
  const end = header(22)
  end.long(0, 0x06054b50); end.short(8, files.length); end.short(10, files.length)
  end.long(12, directorySize); end.long(16, offset)
  return new File([...local, ...central, end.bytes], archiveName, { type })
}

export async function packageFiles(files: File[]): Promise<File[]> {
  return files.length > 1 ? [await zipFiles(files)] : files
}
