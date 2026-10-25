import Dexie from 'dexie'
import type { Contact } from '@/domain/types'
import { db } from '@/db/schema'
import { allContacts, deleteContacts, getMeta, setMeta, upsertContacts } from '@/db/repo'
import { mergeContactFields, type PossibleDuplicate } from './dedupe'
import { migrateDecisions } from './decisions'

export type DuplicateIdentity = Pick<Contact, 'id' | 'displayName' | 'org'>
export type PairResolution = 'kept' | 'merged' | 'dismissed'
export interface DuplicatePair {
  id: string
  a: DuplicateIdentity
  b: DuplicateIdentity
  reason: 'shared phone' | 'shared email' | 'same name'
  createdAt: number
  resolved?: PairResolution
}
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort())
const identity = ({ id, displayName, org }: Contact): DuplicateIdentity => ({ id, displayName, ...(org ? { org } : {}) })

/** Pure: existing identity, creation time and resolution survive repeated imports. */
export function upsertPairs(existing: DuplicatePair[], incoming: DuplicatePair[]): DuplicatePair[] {
  const pairs = new Map<string, DuplicatePair>()
  for (const pair of [...existing, ...incoming]) {
    if (pair.a.id === pair.b.id) continue
    const key = pairKey(pair.a.id, pair.b.id)
    if (!pairs.has(key)) pairs.set(key, { ...pair })
  }
  return [...pairs.values()]
}

/** Pure: callers persist the returned array, preferably inside a meta transaction. */
export function resolvePair(pairs: DuplicatePair[], id: string, resolution: PairResolution): DuplicatePair[] {
  return pairs.map(pair => pair.id === id ? { ...pair, resolved: resolution } : pair)
}

export function candidatePairs(candidates: PossibleDuplicate[], contacts: Contact[], now = Date.now()): DuplicatePair[] {
  const byId = new Map(contacts.map(contact => [contact.id, contact]))
  return candidates.flatMap(candidate => {
    const [a, b] = candidate.ids.map(id => byId.get(id))
    return a && b && a.id !== b.id ? [{ id: pairKey(a.id, b.id), a: identity(a), b: identity(b),
      reason: candidate.reason, createdAt: now }] : []
  })
}

export function prunePairs(pairs: DuplicatePair[], contacts: Contact[]): DuplicatePair[] {
  const byId = new Map(contacts.map(contact => [contact.id, contact]))
  return upsertPairs([], pairs).flatMap(pair => {
    const a = byId.get(pair.a.id), b = byId.get(pair.b.id)
    return a && b ? [{ ...pair, a: identity(a), b: identity(b) }] : []
  })
}

/** Read-only live view: excludes missing contacts and refreshes names/organizations. */
export async function readPossibleDuplicates(): Promise<DuplicatePair[]> {
  const read = async () => {
    const contacts = await allContacts()
    const stored = await getMeta<Array<DuplicatePair | PossibleDuplicate>>('possibleDuplicates', [])
    const pairs = stored.flatMap(pair => 'a' in pair ? [pair] : candidatePairs([{
      ...pair, reason: ['shared phone', 'shared email', 'same name'].includes(pair.reason) ? pair.reason : 'same name',
    }], contacts, 0))
    return prunePairs(pairs, contacts)
  }
  return Dexie.currentTransaction ? read() : db.transaction('r', db.contacts, db.meta, read)
}

/** Persist a resolution without racing another tab's import or pair action. */
export async function savePairResolution(id: string, resolution: PairResolution): Promise<void> {
  await db.transaction('rw', db.contacts, db.meta, async () => {
    await setMeta('possibleDuplicates', resolvePair(await readPossibleDuplicates(), id, resolution))
  })
}

/** Explicitly merge b into a, preserving fields, decisions and tag counts atomically. */
export async function mergePair(aId: string, bId: string): Promise<void> {
  if (aId === bId) throw new Error('Choose two different contacts to merge.')
  await db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const [a, b] = await db.contacts.bulkGet([aId, bId])
    if (!a || !b) throw new Error('A contact in this pair no longer exists. Refresh the duplicate list.')
    await upsertContacts([mergeContactFields(a, b)])
    await migrateDecisions([{ from: bId, to: aId }])
    await deleteContacts([bId])
    await setMeta('possibleDuplicates', await readPossibleDuplicates())
  })
}

/** Review agent contract (#35/#54): /review?dupes=1 is a cross-list "Possible duplicates"
 * view. useLiveQuery(readPossibleDuplicates) returns live pairs; filter !pair.resolved, then
 * display both names/organizations and reason.
 * Keep both / Dismiss call savePairResolution(id, 'kept' | 'dismissed'), which uses the pure
 * resolvePair helper. Merge calls mergePair(a.id, b.id). Deleted-member pairs are excluded
 * immediately from live views and pruned from persisted metadata on the next import/action.
 */
