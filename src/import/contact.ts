import type { ContactSource, EmailEntry, PhoneEntry } from '@/domain/types'
import { keysFor, phoneKey } from './dedupe'
import { defaultCountry as regionCountry } from './region'
import { normalizedName, type ImportedContact } from './metadata'
import { hash } from './hash'

interface ContactFields {
  displayName?: string
  givenName?: string
  familyName?: string
  org?: string
  title?: string
  notes?: string
  rev?: string
  photo?: Blob
  phones: PhoneEntry[]
  emails: EmailEntry[]
  raw?: string
  uid?: string
}

export function makeContact(fields: ContactFields, source: ContactSource, defaultCountry: string = regionCountry()): ImportedContact | undefined {
  const { uid, ...rest } = fields
  const phones = fields.phones.filter((p) => p.value.trim()).map((p) => {
    const key = phoneKey(p.value, defaultCountry)
    return { ...p, defaultCountry, ...(key?.startsWith('+') ? { e164: key } : {}) }
  })
  const emails = fields.emails.filter((e) => e.value.trim())
  const displayName = fields.displayName?.trim()
    || [fields.givenName, fields.familyName].filter(Boolean).join(' ').trim()
    || fields.org?.trim() || emails[0]?.value || phones[0]?.value || ''
  if (!displayName && !phones.length && !emails.length) return undefined
  const keys = keysFor(phones, emails, defaultCountry)
  return {
    ...rest, phones, emails, displayName, ...keys,
    id: hash(uid ? `uid:${uid}` : `${normalizedName(displayName)}|${keys.phoneKeys[0] || keys.emailKeys[0] || `org:${fields.org?.trim().toLowerCase() ?? ''}`}`),
    defaultCountry, hasName: !!(fields.displayName?.trim() || fields.givenName?.trim() || fields.familyName?.trim()),
    raw: fields.raw ?? '', source, importedAt: Date.now(),
  }
}
