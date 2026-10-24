import { property } from './vcardCodec'

/** raw stores decoded source text (including source folds), never undecoded bytes. */
export function decodeFileBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder().decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch {
    const decoder = new TextDecoder('windows-1252')
    const text = decoder.decode(bytes)
    const byteFor = new Map(Array.from({ length: 256 }, (_, byte) => [decoder.decode(Uint8Array.of(byte)), byte]))
    // Mixed legacy files may declare another charset on individual literal properties.
    // Decode those bytes before parsing; QP has its own byte decoder and stays untouched.
    return text.replace(/[^\r\n]+/g, (line) => {
      const prop = property(line)
      const charset = prop?.params.get('CHARSET')?.[0]
      if (!prop || !charset || prop.params.has('ENCODING')) return line
      try {
        const value = new TextDecoder(charset, { fatal: true }).decode(Uint8Array.from(prop.value, (c) => byteFor.get(c)!))
        return line.slice(0, line.length - prop.value.length) + value
      } catch { return line }
    })
  }
}

export async function readText(file: File): Promise<string> {
  const bytes = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
  return decodeFileBytes(bytes)
}
