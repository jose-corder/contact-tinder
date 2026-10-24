import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import type { Contact, EmailEntry, PhoneEntry } from '@/domain/types'
import { CHUNK_SIZE, yieldToBrowser, type OnProgress } from './progress'
import { hash } from './hash'

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
    raw: !first.raw || (next.raw && richness(next) > richness(first)) ? next.raw : first.raw,
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

function richness(c: Contact): number {
  // Score the original, not the already-combined fields from previous duplicates.
  return (c.raw.match(/^[A-Z][^:\r\n]*:.+/gim)?.length ?? 0)
}

const nameKey = (c: Contact) => c.displayName.trim().toLowerCase()
const nameOnly = (c: Contact) => !c.phones.length && !c.emails.length
const intersects = (a: string[], b: string[]) => a.some((key) => b.includes(key))

interface Group { contact: Contact; primary: Map<string, string[]>; existing: Set<string>; touched: boolean }
export interface MergeResult { toUpsert: Contact[]; merged: number; added: number; superseded: string[] }

function compatible(a: Group, b: Group): boolean {
  for (const [left, leftPhones] of a.primary) for (const [right, rightPhones] of b.primary) {
    if (left !== right && left.split('@')[1] === right.split('@')[1] && !intersects(leftPhones, rightPhones)) return false
  }
  return true
}

function mergePrimary(a: Group, b: Group): Map<string, string[]> {
  const primary = new Map(a.primary)
  for (const [email, phones] of b.primary) primary.set(email, [...new Set([...(primary.get(email) ?? []), ...phones])])
  return primary
}

/** Indexed union of identities. Every chunk can yield, including the existing-book scan. */
function* mergeSteps(incoming: Contact[], existing: Contact[]): Generator<number, MergeResult> {
  const groups: Group[] = []
  const parents: number[] = []
  const owners = new Map<string, Set<number>>()
  const root = (index: number): number => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index] }
    return index
  }
  let processed = 0
  for (const original of [...existing, ...incoming]) {
    const index = groups.length
    const isExisting = index < existing.length
    const contact = { ...original, ...keysFor(original.phones, original.emails) }
    const primary = emailKey(contact.emails[0]?.value ?? '')
    groups.push({ contact, primary: new Map(primary ? [[primary, contact.phoneKeys]] : []), existing: new Set(isExisting ? [contact.id] : []), touched: !isExisting })
    parents.push(index)
    const keys = identityKeys(contact)
    const candidates = new Set<number>()
    const name = nameKey(contact)
    const queries = name ? [...keys, `${nameOnly(contact) ? 'name' : 'bare'}:${name}`] : keys
    for (const key of queries) for (const owner of owners.get(key) ?? []) candidates.add(root(owner))
    for (const candidate of candidates) {
      const a = root(candidate)
      const b = root(index)
      if (a === b) continue
      const first = groups[a]
      const next = groups[b]
      const x = first.contact
      const y = next.contact
      const matches = x.id === y.id || intersects(x.phoneKeys, y.phoneKeys) || intersects(x.emailKeys, y.emailKeys)
        || (nameKey(x) === nameKey(y) && (nameOnly(x) || nameOnly(y)))
      if (!matches || !compatible(first, next)) continue
      const keep = Math.min(a, b)
      const remove = Math.max(a, b)
      const earlier = groups[keep]
      const later = groups[remove]
      parents[remove] = keep
      groups[keep] = {
        contact: combine(earlier.contact, later.contact),
        primary: mergePrimary(earlier, later),
        existing: new Set([...earlier.existing, ...later.existing]), touched: earlier.touched || later.touched,
      }
    }
    // Same UID with conflicting primary emails must not overwrite the other person.
    const group = groups[root(index)]
    if (root(index) === index && [...(owners.get(`id:${contact.id}`) ?? [])].some((owner) => root(owner) !== index)) {
      group.contact.id = `${contact.id}-${hash(primary || contact.displayName)}`
      keys.push(`id:${group.contact.id}`)
    }
    for (const key of keys) {
      const set = owners.get(key) ?? new Set<number>()
      // Collapse old roots so repeated imports do not grow quadratic candidate lists.
      owners.set(key, new Set([...set].map(root).concat(root(index))))
    }
    if (name) {
      // Name-only lookups need the full name index; keyed cards only query bare names.
      const named = owners.get(`name:${name}`) ?? new Set<number>()
      named.add(index)
      owners.set(`name:${name}`, named)
      if (nameOnly(contact)) {
        const bare = owners.get(`bare:${name}`) ?? new Set<number>()
        owners.set(`bare:${name}`, new Set([...bare].map(root).concat(root(index))))
      }
    }
    if (++processed % CHUNK_SIZE === 0) yield processed
  }
  const touched = groups.filter((group, index) => root(index) === index && group.touched)
  const added = touched.filter((group) => !group.existing.size).length
  return {
    toUpsert: touched.map((group) => group.contact), added, merged: incoming.length - added,
    superseded: touched.flatMap((group) => [...group.existing].filter((id) => id !== group.contact.id)),
  }
}

export function mergeContacts(incoming: Contact[], existing: Contact[]): MergeResult {
  const steps = mergeSteps(incoming, existing)
  let step = steps.next()
  while (!step.done) step = steps.next()
  return step.value
}

export async function mergeContactsChunked(incoming: Contact[], existing: Contact[], onProgress?: OnProgress): Promise<MergeResult> {
  const total = incoming.length + existing.length
  onProgress?.({ parsed: 0, total, phase: 'deduping' })
  const steps = mergeSteps(incoming, existing)
  let step = steps.next()
  while (!step.done) {
    onProgress?.({ parsed: step.value, total, phase: 'deduping' })
    await yieldToBrowser()
    step = steps.next()
  }
  onProgress?.({ parsed: total, total, phase: 'deduping' })
  return step.value
}
