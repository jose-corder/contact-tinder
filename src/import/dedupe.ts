import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import type { Contact, EmailEntry, PhoneEntry } from '@/domain/types'

export function phoneKey(value: string, defaultCountry = 'US'): string | undefined {
  const number = parsePhoneNumberFromString(value.trim(), defaultCountry as CountryCode)
  if (number?.isPossible()) return number.number
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 ? digits : undefined
}

export function emailKey(value: string): string | undefined {
  const key = value.trim().toLowerCase()
  return key.includes('@') ? key : undefined
}

export function keysFor(phones: PhoneEntry[], emails: EmailEntry[]) {
  const unique = (keys: Array<string | undefined>) => [...new Set(keys.filter((k): k is string => !!k))]
  return {
    phoneKeys: unique(phones.map((p) => phoneKey(p.value))),
    emailKeys: unique(emails.map((e) => emailKey(e.value))),
  }
}

function unionEntries<T extends { value: string }>(a: T[], b: T[], key: (value: string) => string | undefined): T[] {
  const entries = new Map<string, T>()
  for (const entry of [...a, ...b]) {
    const k = key(entry.value) ?? entry.value.trim().toLowerCase()
    const previous = entries.get(k)
    entries.set(k, previous ? { ...entry, ...previous } : { ...entry })
  }
  return [...entries.values()]
}

function combine(first: Contact, next: Contact): Contact {
  const phones = unionEntries(first.phones, next.phones, phoneKey)
  const emails = unionEntries(first.emails, next.emails, emailKey)
  const keys = keysFor(phones, emails)
  return {
    ...first,
    displayName: first.displayName.trim() ? first.displayName : next.displayName,
    givenName: first.givenName || next.givenName,
    familyName: first.familyName || next.familyName,
    org: first.org || next.org,
    title: first.title || next.title,
    notes: first.notes || next.notes,
    photo: first.photo?.size ? first.photo : next.photo,
    rev: first.rev || next.rev,
    raw: first.raw || next.raw,
    phones, emails,
    phoneKeys: [...new Set([...first.phoneKeys, ...next.phoneKeys, ...keys.phoneKeys])],
    emailKeys: [...new Set([...first.emailKeys, ...next.emailKeys, ...keys.emailKeys])],
  }
}

/** Prefix keys to avoid matching a phone, email and stable id across namespaces. */
export function identityKeys(contact: Contact): string[] {
  const keys = keysFor(contact.phones, contact.emails)
  return [
    `id:${contact.id}`,
    ...new Set([...contact.phoneKeys, ...keys.phoneKeys].map((key) => `tel:${key}`)),
    ...new Set([...contact.emailKeys, ...keys.emailKeys].map((key) => `email:${key}`)),
  ]
}

export function mergeContacts(incoming: Contact[], existing: Contact[]): { toUpsert: Contact[]; merged: number; added: number } {
  const contacts = [...existing, ...incoming]
  const parents = contacts.map((_, index) => index)
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]]
      index = parents[index]
    }
    return index
  }
  const owners = new Map<string, number>()
  contacts.forEach((contact, index) => {
    for (const key of identityKeys(contact)) {
      const owner = owners.get(key)
      if (owner === undefined) owners.set(key, index)
      else {
        const a = root(owner)
        const b = root(index)
        parents[Math.max(a, b)] = Math.min(a, b)
      }
    }
  })
  const touched = new Set(incoming.map((_, index) => root(existing.length + index)))
  const groups = new Map<number, Contact>()
  contacts.forEach((contact, index) => {
    const key = root(index)
    if (!touched.has(key)) return
    const previous = groups.get(key)
    const keys = keysFor(contact.phones, contact.emails)
    groups.set(key, previous ? combine(previous, contact) : {
      ...contact,
      phoneKeys: [...new Set([...contact.phoneKeys, ...keys.phoneKeys])],
      emailKeys: [...new Set([...contact.emailKeys, ...keys.emailKeys])],
    })
  })
  const added = [...touched].filter((index) => index >= existing.length).length
  return { toUpsert: [...groups.values()], merged: incoming.length - added, added }
}
