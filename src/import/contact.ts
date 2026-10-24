import type { Contact, ContactSource, EmailEntry, PhoneEntry } from '@/domain/types'
import { keysFor, phoneKey } from './dedupe'
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

export function makeContact(fields: ContactFields, source: ContactSource): Contact | undefined {
  const { uid, ...rest } = fields
  const phones = fields.phones.filter((p) => p.value.trim()).map((p) => {
    const key = phoneKey(p.value)
    return { ...p, ...(key?.startsWith('+') ? { e164: key } : {}) }
  })
  const emails = fields.emails.filter((e) => e.value.trim())
  const displayName = fields.displayName?.trim()
    || [fields.givenName, fields.familyName].filter(Boolean).join(' ').trim()
    || fields.org?.trim() || emails[0]?.value || phones[0]?.value || ''
  if (!displayName && !phones.length && !emails.length) return undefined
  const keys = keysFor(phones, emails)
  return {
    ...rest, phones, emails, displayName, ...keys,
    id: hash(uid ? `uid:${uid}` : `${displayName.toLowerCase()}|${keys.phoneKeys[0] || keys.emailKeys[0] || ''}`),
    raw: fields.raw ?? '', source, importedAt: Date.now(),
  }
}
