import type { Contact } from '@/domain/types'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { identityKeys, mergeContacts } from './dedupe'
import { parseCsv } from './csv'
import { parseVcf } from './vcard'

export interface ImportResult {
  added: number
  merged: number
  /** Number of incoming contacts processed, including duplicates. */
  total: number
  errors: string[]
}

export async function importContacts(contacts: Contact[]): Promise<ImportResult> {
  // A single transaction prevents concurrent imports from racing the dedupe read.
  return db.transaction('rw', db.contacts, db.decisions, async () => {
    const existing = await repo.allContacts()
    const { toUpsert, added, merged } = mergeContacts(contacts, existing)
    const retained = new Set(toUpsert.map((contact) => contact.id))
    const mergedKeys = new Set(toUpsert.flatMap(identityKeys))
    const superseded = existing.filter((contact) => !retained.has(contact.id)
      && identityKeys(contact).some((key) => mergedKeys.has(key)))
    await repo.upsertContacts(toUpsert)
    // A new contact can bridge two existing records. Remove the redundant row;
    // the first existing identity (and its decision) remains authoritative.
    if (superseded.length) await repo.deleteContacts(superseded.map((contact) => contact.id))
    return { added, merged, total: contacts.length, errors: [] }
  })
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to read this file.'
}

/** FileReader also covers browsers/test environments without Blob.text(). */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read this file.'))
    reader.readAsText(file)
  })
}

export async function importFiles(files: File[]): Promise<ImportResult> {
  const contacts: Contact[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      const text = await readText(file)
      const extension = file.name.split('.').pop()?.toLowerCase()
      const isVcf = extension === 'vcf' || extension === 'vcard'
        || (extension !== 'csv' && /^BEGIN:VCARD/i.test(text.replace(/^\uFEFF/, '').trimStart()))
      const parsed = isVcf ? parseVcf(text) : parseCsv(text)
      if (!parsed.length) errors.push(`${file.name}: No contacts found.`)
      contacts.push(...parsed)
    } catch (error) { errors.push(`${file.name}: ${message(error)}`) }
  }
  const result = await importContacts(contacts)
  return { ...result, errors }
}

export async function importDemo(): Promise<ImportResult> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo.vcf`)
  if (!response.ok) throw new Error('The demo could not be loaded. Please try again.')
  const contacts = parseVcf(await response.text(), 'demo')
  if (!contacts.length) throw new Error('No demo contacts were found.')
  return importContacts(contacts)
}
