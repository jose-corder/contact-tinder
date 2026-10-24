// Typed data access. Components should use these (or useLiveQuery over db.*) instead of raw Dexie calls.
import { db } from './schema'
import { isInDeck, isUnsorted, normalizeTag, PASS_ORDER } from '@/domain/taxonomy'
import {
  emptyDecision,
  type Contact, type Counts, type Decision, type Pass,
} from '@/domain/types'

export interface ContactWithDecision {
  contact: Contact
  decision: Decision
}

// ----- contacts -----

/** Insert or replace contacts by id. Dedupe/merge against existing rows happens in src/import before this. */
export async function upsertContacts(contacts: Contact[]): Promise<number> {
  if (contacts.length === 0) return 0
  await db.contacts.bulkPut(contacts)
  return contacts.length
}

export function allContacts(): Promise<Contact[]> {
  return db.contacts.orderBy('displayName').toArray()
}

export function contactById(id: string): Promise<Contact | undefined> {
  return db.contacts.get(id)
}

export function findByPhoneKeys(keys: string[]): Promise<Contact[]> {
  return keys.length ? db.contacts.where('phoneKeys').anyOf(keys).toArray() : Promise.resolve([])
}

export function findByEmailKeys(keys: string[]): Promise<Contact[]> {
  return keys.length ? db.contacts.where('emailKeys').anyOf(keys).toArray() : Promise.resolve([])
}

/** Remove contacts, their decisions, and their share of the tag vocabulary. One transaction. */
export async function deleteContacts(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.contacts, db.decisions, db.tags, async () => {
    const decisions = await db.decisions.bulkGet(ids)
    for (const d of decisions) for (const t of d?.customTags ?? []) await bumpTag(t, -1)
    await db.contacts.bulkDelete(ids)
    await db.decisions.bulkDelete(ids)
  })
}

// ----- decisions -----

export async function getDecision(contactId: string): Promise<Decision> {
  return (await db.decisions.get(contactId)) ?? emptyDecision(contactId)
}

/** Thrown by saveDecision when the stored row changed since the caller read it. */
export class StaleDecisionError extends Error {
  readonly contactId: string
  readonly stored: Decision | undefined

  constructor(contactId: string, stored: Decision | undefined) {
    super(`Decision for ${contactId} changed since it was read`)
    this.name = 'StaleDecisionError'
    this.contactId = contactId
    this.stored = stored
  }
}

export interface SaveOptions {
  /**
   * Optimistic concurrency: the `updatedAt` the caller last read (undefined = row did not exist).
   * When given and the stored row differs, nothing is written and StaleDecisionError is thrown.
   */
  expectedUpdatedAt?: number | null
}

async function writeDecision(decision: Decision, options?: SaveOptions): Promise<void> {
  const prev = await db.decisions.get(decision.contactId)
  if (options && 'expectedUpdatedAt' in options) {
    const expected = options.expectedUpdatedAt ?? undefined
    if ((prev?.updatedAt ?? undefined) !== expected) throw new StaleDecisionError(decision.contactId, prev)
  }
  await db.decisions.put(decision)
  const before = new Set(prev?.customTags ?? [])
  const after = new Set(decision.customTags)
  for (const t of after) if (!before.has(t)) await bumpTag(t, +1)
  for (const t of before) if (!after.has(t)) await bumpTag(t, -1)
}

/** Persist a decision and keep the custom-tag vocabulary up to date. One transaction. */
export async function saveDecision(decision: Decision, options?: SaveOptions): Promise<void> {
  await db.transaction('rw', db.decisions, db.tags, () => writeDecision(decision, options))
}

/** Persist many decisions atomically: either every row is written or none is. */
export async function saveDecisions(decisions: Decision[]): Promise<void> {
  if (decisions.length === 0) return
  await db.transaction('rw', db.decisions, db.tags, async () => {
    for (const d of decisions) await writeDecision(d)
  })
}

export function allDecisions(): Promise<Decision[]> {
  return db.decisions.toArray()
}

async function bumpTag(name: string, delta: number) {
  const t = normalizeTag(name)
  if (!t) return
  const row = await db.tags.get(t)
  const count = (row?.count ?? 0) + delta
  if (count <= 0) await db.tags.delete(t)
  else await db.tags.put({ name: t, count })
}

/** Custom tags, most used first. For chip autocomplete. */
export async function allTags(): Promise<string[]> {
  const rows = await db.tags.orderBy('count').reverse().toArray()
  return rows.map((r) => r.name)
}

// ----- joins -----

export async function allWithDecisions(): Promise<ContactWithDecision[]> {
  const [contacts, decisions] = await Promise.all([allContacts(), allDecisions()])
  const byId = new Map(decisions.map((d) => [d.contactId, d]))
  return contacts.map((contact) => ({ contact, decision: byId.get(contact.id) ?? emptyDecision(contact.id) }))
}

/**
 * Contacts that belong in the given deck, least-skipped first, then by name.
 * Skipped cards therefore return at the end of the same deck.
 */
export async function deckContacts(pass: Pass): Promise<ContactWithDecision[]> {
  const rows = await allWithDecisions()
  return rows
    .filter((r) => isInDeck(r.decision, pass))
    .sort((a, b) => a.decision.skips[pass] - b.decision.skips[pass] || a.contact.displayName.localeCompare(b.contact.displayName))
}

export async function counts(): Promise<Counts> {
  const rows = await allWithDecisions()
  const c: Counts = {
    total: rows.length,
    undecided: 0,
    unsorted: { triage: 0, work: 0, personal: 0 },
    bucket: { delete: 0, work: 0, personal: 0 },
    workStatus: { old: 0, current: 0, potential: 0 },
    workType: { client: 0, vendor: 0, relationship: 0, namedrop: 0 },
    relation: { friend: 0, family: 0, ex: 0 },
    personalType: { acquaintance: 0, neighbor: 0, service: 0 },
  }
  for (const { decision: d } of rows) {
    if (!d.bucket) c.undecided++
    else c.bucket[d.bucket]++
    for (const p of PASS_ORDER) if (isUnsorted(d, p)) c.unsorted[p]++
    if (d.bucket === 'work') {
      if (d.workStatus) c.workStatus[d.workStatus]++
      for (const t of d.workTypes) c.workType[t]++
    }
    if (d.bucket === 'personal') {
      if (d.relation) c.relation[d.relation]++
      for (const t of d.personalTypes) c.personalType[t]++
    }
  }
  return c
}

// ----- meta -----

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

// ----- backup / reset -----

export interface Dump {
  version: 1
  exportedAt: string
  contacts: Omit<Contact, 'photo'>[]
  decisions: Decision[]
}

/** JSON-safe snapshot of everything except photos (blobs). */
export async function dumpAll(): Promise<Dump> {
  const [contacts, decisions] = await Promise.all([allContacts(), allDecisions()])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    contacts: contacts.map(({ photo: _photo, ...rest }) => rest),
    decisions,
  }
}

export type RestoreMode = 'replace' | 'merge'

/**
 * Restore a backup. `replace` (default) makes the database match the snapshot exactly:
 * contacts and decisions not in the backup are removed. `merge` upserts on top of what exists.
 * Photos are not in backups, so existing photo blobs are kept for contacts that are still present.
 */
export async function restoreAll(dump: Dump, mode: RestoreMode = 'replace'): Promise<void> {
  await db.transaction('rw', db.contacts, db.decisions, db.tags, async () => {
    const ids = dump.contacts.map((c) => c.id)
    const existing = await db.contacts.bulkGet(ids)
    const photos = new Map<string, Blob>()
    existing.forEach((c) => { if (c?.photo) photos.set(c.id, c.photo) })
    if (mode === 'replace') {
      await Promise.all([db.contacts.clear(), db.decisions.clear(), db.tags.clear()])
    }
    const contacts = dump.contacts.map((c) => {
      const photo = photos.get(c.id)
      return (photo ? { ...c, photo } : c) as Contact
    })
    await db.contacts.bulkPut(contacts)
    const known = new Set(ids)
    for (const d of dump.decisions) if (known.has(d.contactId)) await writeDecision(d)
  })
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    await Promise.all([db.contacts.clear(), db.decisions.clear(), db.tags.clear(), db.meta.clear()])
  })
}
