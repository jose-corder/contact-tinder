import type { Contact } from '@/domain/types'

/** Import-owned metadata persists with the contact without changing the shared projection. */
export interface ImportedContact extends Contact {
  defaultCountry?: string
  hasName?: boolean
  /** Other decoded source cards; raw remains the richest decoded source text, not original bytes. */
  rawCards?: string[]
}

export const metadata = (contact: Contact): ImportedContact => contact
export const rawCards = (contact: Contact): string[] =>
  [...new Set([contact.raw, ...(metadata(contact).rawCards ?? [])].filter(Boolean))]

export function normalizedName(value: string): string {
  const words = value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().split(/\s+/)
  return words.length > 2 ? words[0] + ' ' + words.at(-1) : words.join(' ')
}

export function identityName(contact: Contact): string {
  if (metadata(contact).hasName === false) return ''
  return normalizedName(contact.displayName)
}
