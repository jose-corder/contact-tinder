import Dexie from 'dexie'
import type { Contact } from '@/domain/types'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { mergeContactsChunked } from './dedupe'
import { parseCsvChunks, parseVcfChunks } from './parseChunks'
import { yieldToBrowser, type OnProgress } from './progress'

export type { ImportProgress, OnProgress } from './progress'

export interface ImportResult {
  added: number
  merged: number
  total: number
  errors: string[]
}

export interface ImportPreview extends ImportResult {
  contacts: Contact[]
  photos: number
  skipped: number
  allAlreadyImported: boolean
}

export async function importContacts(contacts: Contact[], onProgress?: OnProgress): Promise<ImportResult> {
  // Keep dedupe and all batches atomic, including concurrent imports in other tabs.
  return db.transaction('rw', db.contacts, db.decisions, db.tags, async () => {
    const existing = await repo.allContacts()
    const { toUpsert, added, merged, superseded } = await Dexie.waitFor(mergeContactsChunked(contacts, existing, onProgress))
    onProgress?.({ parsed: 0, total: toUpsert.length, phase: 'saving' })
    for (let offset = 0; offset < toUpsert.length; offset += 500) {
      await repo.upsertContacts(toUpsert.slice(offset, offset + 500))
      onProgress?.({ parsed: Math.min(offset + 500, toUpsert.length), total: toUpsert.length, phase: 'saving' })
      await Dexie.waitFor(yieldToBrowser())
    }
    if (superseded.length) await repo.deleteContacts(superseded)
    return { added, merged, total: contacts.length, errors: [] }
  })
}

/** FileReader also covers browsers/test environments without Blob.text(). */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function comparable(c: Contact): string {
  // Thumbnail encoders may differ by browser; exact original photo bytes are in raw.
  return JSON.stringify([c.id, c.displayName, c.givenName, c.familyName, c.org, c.title,
    c.notes, c.rev, c.raw, c.source, c.phones.map((p) => [p.value, p.type, p.e164]),
    c.emails.map((e) => [e.value, e.type]), c.phoneKeys, c.emailKeys,
    !c.raw && c.photo ? [c.photo.size, c.photo.type] : null])
}

export async function previewContacts(contacts: Contact[], onProgress?: OnProgress): Promise<ImportPreview> {
  const existing = await repo.allContacts()
  const result = await mergeContactsChunked(contacts, existing, onProgress)
  const byId = new Map(existing.map((contact) => [contact.id, comparable(contact)]))
  return {
    contacts, total: contacts.length, added: result.added, merged: result.merged,
    photos: contacts.filter((contact) => contact.photo).length, errors: [], skipped: 0,
    allAlreadyImported: contacts.length > 0 && result.added === 0 && !result.superseded.length
      && result.toUpsert.every((contact) => comparable(contact) === byId.get(contact.id)),
  }
}

/** Read and check only: cancelling a preview has no database side effects. */
export async function previewFiles(files: File[], onProgress?: OnProgress): Promise<ImportPreview> {
  const contacts: Contact[] = []
  const errors: string[] = []
  let skipped = 0
  for (const file of files) {
    onProgress?.({ parsed: contacts.length, phase: 'reading' })
    await yieldToBrowser()
    const unreadable = `Nothing we could read in \`${file.name}\`. Try the vCard export instead.`
    try {
      const text = await readText(file)
      const extension = file.name.split('.').pop()?.toLowerCase()
      const isVcf = extension === 'vcf' || extension === 'vcard'
        || (extension !== 'csv' && /^BEGIN:VCARD/i.test(text.replace(/^\uFEFF/, '').trimStart()))
      const progress: OnProgress = (value) => onProgress?.({ ...value, parsed: value.parsed + contacts.length,
        total: value.total === undefined ? undefined : value.total + contacts.length })
      const parsed = await (isVcf ? parseVcfChunks(text, progress) : parseCsvChunks(text, progress))
      skipped += parsed.skipped
      if (!parsed.contacts.length) errors.push(unreadable)
      else if (parsed.skipped) errors.push(`${file.name}: ${parsed.skipped.toLocaleString()} unreadable ${isVcf ? 'cards' : 'rows'} skipped. The rest are ready to import.`)
      contacts.push(...parsed.contacts)
    } catch { errors.push(unreadable) }
  }
  return { ...await previewContacts(contacts, onProgress), errors, skipped }
}

export async function commitPreview(preview: ImportPreview, onProgress?: OnProgress): Promise<ImportResult> {
  const result = await importContacts(preview.contacts, onProgress)
  return { ...result, errors: preview.errors }
}

export async function importFiles(files: File[], onProgress?: OnProgress): Promise<ImportResult> {
  return commitPreview(await previewFiles(files, onProgress), onProgress)
}

export async function importDemo(onProgress?: OnProgress): Promise<ImportResult> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo.vcf`)
  if (!response.ok) throw new Error('The demo could not be loaded. Please try again.')
  const { contacts } = await parseVcfChunks(await response.text(), onProgress, 'demo')
  if (!contacts.length) throw new Error('No demo contacts were found.')
  return importContacts(contacts, onProgress)
}
