import type { Contact } from '@/domain/types'
import { metadata, rawCards } from '@/import/metadata'
import { emailKey, phoneKey } from '@/import/dedupe'
import { decodeQuotedPrintable, logicalLines, property, unescapeValue } from '@/import/vcardCodec'

export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

/** Every continuation's leading space counts toward the 75 UTF-8 octet limit. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  let output = '', bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (bytes + size > 75) { output += '\r\n '; bytes = 1 }
    output += character
    bytes += size
  }
  return output
}

/** Files are emitted as UTF-8; literal decoded values must advertise the emitted charset. */
export function utf8LiteralCharsets(raw: string): string {
  return raw.replace(/^[^\r\n]+/gm, (line) => {
    const prop = property(line)
    if (!prop?.params.has('CHARSET') || prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE') return line
    const headerLength = line.length - prop.value.length
    return line.slice(0, headerLength).replace(/;CHARSET=(?:"[^"]*"|[^;:]*)/i, ';CHARSET=UTF-8') + prop.value
  })
}

export function sourceCategories(contact: Contact): string[] {
  const result: string[] = []
  for (const raw of rawCards(contact)) for (const line of logicalLines(raw)) {
    const prop = property(line)
    if (prop?.name !== 'CATEGORIES') continue
    const value = prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE'
      ? decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0]) : prop.value
    const parts = value.match(/(?:\\.|[^,\\])+/g) ?? []
    result.push(...parts.map(unescapeValue))
  }
  return result
}

/** Extra decoded source properties remain proper properties, including unknown vendor fields. */
export function complementaryLines(contact: Contact): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const country = metadata(contact).defaultCountry
  const keyFor = (line: string) => {
    const prop = property(line)
    if (!prop) return line
    const decoded = unescapeValue(prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE'
      ? decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0]) : prop.value)
    if (prop.name === 'TEL') return 'TEL:' + (phoneKey(decoded.replace(/^tel:/i, ''), country) ?? decoded)
    if (prop.name === 'EMAIL') return 'EMAIL:' + (emailKey(decoded.replace(/^mailto:/i, '')) ?? decoded)
    if (prop.name === 'NOTE') return 'NOTE:' + decoded
    return line
  }
  for (const line of logicalLines(contact.raw)) seen.add(keyFor(line))
  const skip = new Set(['BEGIN', 'END', 'VERSION', 'UID', 'FN', 'N', 'REV', 'PHOTO', 'CATEGORIES'])
  for (const [index, raw] of (metadata(contact).rawCards ?? []).entries()) {
    for (const line of logicalLines(raw)) {
      const prop = property(line)
      if (!prop || skip.has(prop.name) || seen.has(keyFor(line))) continue
      seen.add(keyFor(line))
      // Separate Apple group namespaces from different source cards.
      let portable = line
      if (prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE') {
        const header = line.slice(0, line.length - prop.value.length - 1)
          .replace(/;ENCODING=(?:"QUOTED-PRINTABLE"|QUOTED-PRINTABLE)/i, '').replace(/;CHARSET=(?:"[^"]*"|[^;:]*)/i, '')
        portable = header + ':' + decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0])
      }
      const renamed = prop.group ? portable.replace(/^[^.]+\./, 'merged' + index + '-' + prop.group + '.') : portable
      result.push(foldLine(utf8LiteralCharsets(renamed)))
    }
  }
  return result
}
