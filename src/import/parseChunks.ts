import { defaultCountry as regionCountry } from './region'
import Papa from 'papaparse'
import type { Contact, ContactSource } from '@/domain/types'
import { csvContact } from './csv'
import { parseVcf } from './vcard'
import { resizePhoto } from './photos'
import { CHUNK_SIZE, yieldToBrowser, type OnProgress } from './progress'

export interface ParsedContacts { contacts: Contact[]; skipped: number }

/** Scan boundaries without copying a whole file or letting a broken card swallow its neighbour. */
export async function parseVcfChunks(text: string, onProgress?: OnProgress, source: ContactSource = 'vcf', defaultCountry: string = regionCountry()): Promise<ParsedContacts> {
  const contacts: Contact[] = []
  let skipped = 0
  let start: number | undefined
  let processed = 0
  const boundaries = /^(?:\uFEFF)?(BEGIN|END):VCARD[ \t]*(?:\r\n|\n|\r|$)/gim
  for (const match of text.matchAll(boundaries)) {
    if (match[1].toUpperCase() === 'BEGIN') {
      if (start !== undefined) skipped++
      start = match.index + (match[0].startsWith('\uFEFF') ? 1 : 0)
      continue
    }
    if (start === undefined) continue
    const raw = text.slice(start, match.index + match[0].length)
    start = undefined
    try {
      const contact = parseVcf(raw, source, defaultCountry)[0]
      if (contact) {
        if (contact.photo) contact.photo = await resizePhoto(contact.photo)
        contacts.push(contact)
      } else skipped++
    } catch { skipped++ }
    if (++processed % CHUNK_SIZE === 0) {
      onProgress?.({ parsed: contacts.length, phase: 'parsing' })
      await yieldToBrowser()
    }
  }
  if (start !== undefined) skipped++
  onProgress?.({ parsed: contacts.length, total: contacts.length, phase: 'parsing' })
  return { contacts, skipped }
}

/** Papa retains quoted/multiline CSV state across pauses; bad rows do not discard good rows. */
export function parseCsvChunks(text: string, onProgress?: OnProgress, defaultCountry: string = regionCountry()): Promise<ParsedContacts> {
  return new Promise((resolve, reject) => {
    const contacts: Contact[] = []
    let skipped = 0
    let processed = 0
    Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
      header: true, skipEmptyLines: 'greedy', chunkSize: 256 * 1024,
      transformHeader: (header) => header.trim(),
      step(result, parser) {
        try {
          const invalid = result.errors.some((error) => error.code !== 'UndetectableDelimiter')
          const contact = invalid ? undefined : csvContact(result.data, defaultCountry)
          if (contact) contacts.push(contact)
          else skipped++
          if (++processed % CHUNK_SIZE === 0) {
            parser.pause()
            onProgress?.({ parsed: contacts.length, phase: 'parsing' })
            void yieldToBrowser().then(() => parser.resume()).catch(reject)
          }
        } catch (error) { parser.abort(); reject(error) }
      },
      complete() {
        onProgress?.({ parsed: contacts.length, total: contacts.length, phase: 'parsing' })
        resolve({ contacts, skipped })
      },
      error: reject,
    })
  })
}
