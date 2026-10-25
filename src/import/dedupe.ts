import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import type { Contact, EmailEntry, PhoneEntry } from '@/domain/types'
import { CHUNK_SIZE, yieldToBrowser, type OnProgress } from './progress'
import { defaultCountry as regionCountry } from './region'
import { identityName, metadata, rawCards, type ImportedContact } from './metadata'
import { hash } from './hash'
import { describeMergePair, type MergePair } from './mergeSummary'

export function phoneKey(value: string, defaultCountry: string = regionCountry()): string | undefined {
  const number = parsePhoneNumberFromString(value.trim(), defaultCountry as CountryCode)
  if (number && (value.trim().startsWith('+') ? number.isPossible() : number.isValid())) return number.number
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 ? (value.trim().startsWith('+') ? `+${digits}` : `${defaultCountry}:${digits}`) : undefined
}

export function emailKey(value: string): string | undefined {
  const key = value.trim().toLowerCase()
  return key.includes('@') ? key : undefined
}

export function keysFor(phones: PhoneEntry[], emails: EmailEntry[], defaultCountry: string = regionCountry()) {
  const unique = (keys: Array<string | undefined>) => [...new Set(keys.filter((k): k is string => !!k))]
  return {
    phoneKeys: unique(phones.map((p) => phoneKey(p.e164 || p.value, (p as PhoneEntry & { defaultCountry?: string }).defaultCountry || defaultCountry))),
    emailKeys: unique(emails.map((e) => emailKey(e.value))),
  }
}

function unionEntries<T extends { value: string }>(a: T[], b: T[], key: (entry: T) => string | undefined): T[] {
  const entries = new Map<string, T>()
  for (const entry of [...a, ...b]) {
    const k = key(entry) ?? entry.value.trim().toLowerCase()
    const previous = entries.get(k)
    entries.set(k, previous ? { ...entry, ...previous } : { ...entry })
  }
  return [...entries.values()]
}

function combine(first: Contact, next: Contact, defaultCountry: string): ImportedContact {
  const phones = unionEntries(first.phones, next.phones, (p) => phoneKey(p.e164 || p.value, (p as PhoneEntry & { defaultCountry?: string }).defaultCountry || defaultCountry))
  const emails = unionEntries(first.emails, next.emails, (e) => emailKey(e.value))
  const keys = keysFor(phones, emails, defaultCountry)
  const raw = !first.raw || (next.raw && richness(next) > richness(first)) ? next.raw : first.raw
  return {
    ...metadata(first),
    hasName: !!(identityName(first) || identityName(next)),
    rawCards: [...new Set([...rawCards(first), ...rawCards(next)])].filter((card) => card !== raw),
    displayName: identityName(first) ? first.displayName : next.displayName,
    givenName: first.givenName || next.givenName,
    familyName: first.familyName || next.familyName,
    org: first.org || next.org,
    title: first.title || next.title,
    notes: [...new Set([first.notes, next.notes].filter(Boolean).flatMap((note) => note!.split('\n')))].join('\n') || undefined,
    photo: first.photo?.size ? first.photo : next.photo,
    rev: first.rev || next.rev,
    raw,
    phones, emails,
    phoneKeys: [...new Set([...first.phoneKeys, ...next.phoneKeys, ...keys.phoneKeys])],
    emailKeys: [...new Set([...first.emailKeys, ...next.emailKeys, ...keys.emailKeys])],
  }
}

/** Prefix keys to avoid matching a phone, email and stable id across namespaces. */
export function identityKeys(contact: Contact, defaultCountry: string = regionCountry()): string[] {
  const keys = keysFor(contact.phones, contact.emails, metadata(contact).defaultCountry || defaultCountry)
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

const nameKey = identityName
const nameOnly = (c: Contact) => !c.phones.length && !c.emails.length
const intersects = (a: string[], b: string[]) => a.some((key) => b.includes(key))

interface Group { contact: Contact; names: Set<string>; existing: Set<string>; touched: boolean }
export interface PossibleDuplicate { ids: string[]; reason: string }
export interface MergeResult {
  toUpsert: Contact[]; merged: number; added: number; superseded: string[]
  migrations: Array<{ from: string; to: string }>
  possibleDuplicates: PossibleDuplicate[]
  mergePairs: MergePair[]
  keptApartPairs: MergePair[]
}

function compatible(a: Group, b: Group): boolean {
  return new Set([...a.names, ...b.names]).size <= 1
}

const orgKey = (c: Contact) => (c.org ?? '').normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase()
const bareMatch = (a: Contact, b: Contact) => nameOnly(a) && (!b.org || orgKey(a) === orgKey(b))

/** Indexed union of identities. Every chunk can yield, including the existing-book scan. */
function* mergeSteps(incoming: Contact[], existing: Contact[], defaultCountry: string): Generator<number, MergeResult> {
  const groups: Group[] = []
  const rejected: Array<[number, number]> = []
  const mergePairs: MergePair[] = []
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
    const contact = { ...original, ...keysFor(original.phones, original.emails, metadata(original).defaultCountry || defaultCountry) }
    groups.push({ contact, names: new Set(identityName(contact) ? [identityName(contact)] : []), existing: new Set(isExisting ? [contact.id] : []), touched: !isExisting })
    parents.push(index)
    const disambiguatedId = `${contact.id}-${hash([nameKey(contact), orgKey(contact), ...contact.phoneKeys, ...contact.emailKeys].join('|'))}`
    const keys = [...identityKeys(contact, defaultCountry), `id:${disambiguatedId}`]
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
      const matches = x.id === y.id || x.id === disambiguatedId || intersects(x.phoneKeys, y.phoneKeys) || intersects(x.emailKeys, y.emailKeys)
        || (nameKey(x) === nameKey(y) && (nameOnly(x) || nameOnly(y)))
      if (!matches) continue
      const nameOnlyMatch = nameKey(x) && nameKey(x) === nameKey(y) && (bareMatch(x, y) || bareMatch(y, x))
      const sharedKey = intersects(x.phoneKeys, y.phoneKeys) || intersects(x.emailKeys, y.emailKeys)
      const orgConflict = (nameOnly(x) || nameOnly(y)) && x.org && y.org && orgKey(x) !== orgKey(y)
      if (!compatible(first, next) || orgConflict || (!sharedKey && x.id !== y.id && x.id !== disambiguatedId && !nameOnlyMatch)) {
        rejected.push([a, b])
        continue
      }
      const keep = Math.min(a, b)
      if ((!isExisting || first.touched || next.touched) && mergePairs.length < 20) mergePairs.push(describeMergePair(x, y))
      const remove = Math.max(a, b)
      const earlier = groups[keep]
      const later = groups[remove]
      parents[remove] = keep
      groups[keep] = {
        contact: combine(earlier.contact, later.contact, metadata(earlier.contact).defaultCountry || defaultCountry),
        names: new Set([...earlier.names, ...later.names]),
        existing: new Set([...earlier.existing, ...later.existing]), touched: earlier.touched || later.touched,
      }
    }
    // Conflicting identities that reuse a UID must remain separate and re-import idempotently.
    const group = groups[root(index)]
    if (root(index) === index && [...(owners.get(`id:${contact.id}`) ?? [])].some((owner) => root(owner) !== index)) {
      group.contact.id = disambiguatedId
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
    mergePairs,
    keptApartPairs: [...new Map(rejected.flatMap(([a, b]) => {
      const left = groups[root(a)], right = groups[root(b)]
      if (root(a) === root(b) || (!left.touched && !right.touched)) return []
      return [[[left.contact.id, right.contact.id].sort().join('|'), describeMergePair(left.contact, right.contact, true)] as const]
    })).values()].slice(0, 20),
    possibleDuplicates: [...new Map(rejected.map(([a, b]) => {
      const left = groups[root(a)], right = groups[root(b)]
      if (root(a) === root(b) || (!left.touched && !right.touched)) return undefined
      const ids = [left.contact.id, right.contact.id].sort()
      return [ids.join('|'), { ids, reason: 'Shared details with conflicting identity evidence' }] as const
    }).filter((entry) => entry !== undefined)).values()],
    migrations: touched.flatMap((group) => [...group.existing].filter((id) => id !== group.contact.id).map((from) => ({ from, to: group.contact.id }))),
    toUpsert: touched.map((group) => group.contact), added, merged: incoming.length - added,
    superseded: touched.flatMap((group) => [...group.existing].filter((id) => id !== group.contact.id)),
  }
}

export function mergeContacts(incoming: Contact[], existing: Contact[], defaultCountry: string = regionCountry()): MergeResult {
  const steps = mergeSteps(incoming, existing, defaultCountry)
  let step = steps.next()
  while (!step.done) step = steps.next()
  return step.value
}

export async function mergeContactsChunked(incoming: Contact[], existing: Contact[], onProgress?: OnProgress, defaultCountry: string = regionCountry()): Promise<MergeResult> {
  const total = incoming.length + existing.length
  onProgress?.({ parsed: 0, total, phase: 'deduping' })
  const steps = mergeSteps(incoming, existing, defaultCountry)
  let step = steps.next()
  while (!step.done) {
    onProgress?.({ parsed: step.value, total, phase: 'deduping' })
    await yieldToBrowser()
    step = steps.next()
  }
  onProgress?.({ parsed: total, total, phase: 'deduping' })
  return step.value
}
