import Dexie from 'dexie'
import type { Contact } from '@/domain/types'
import { db } from '@/db/schema'
import { allContacts, getMeta, setMeta } from '@/db/repo'
import type { PossibleDuplicate } from './dedupe'
export { prepareMerge, mergePair, undoMerge, type MergeComparison, type MergeOptions, type MergeResult, type UndoMergeResult } from './merge'
export { proposedDecision, type DecisionChoice } from './mergeDecision'

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
    return prunePairs(await readStoredPairs(contacts), contacts)
  }
  return Dexie.currentTransaction ? read() : db.transaction('r', db.contacts, db.meta, read)
}

/** #59: mutations must read candidates before a live view prunes missing members. */
export async function readStoredPairs(contacts?: Contact[]): Promise<DuplicatePair[]> {
  const stored = await getMeta<Array<DuplicatePair | PossibleDuplicate>>('possibleDuplicates', [])
  const known = contacts ?? await allContacts()
  return stored.flatMap(pair => 'a' in pair ? [pair] : candidatePairs([{
    ...pair, reason: ['shared phone', 'shared email', 'same name'].includes(pair.reason) ? pair.reason : 'same name',
  }], known, 0))
}

/** Persist a resolution without racing another tab's import or pair action. */
export async function savePairResolution(id: string, resolution: PairResolution): Promise<void> {
  await db.transaction('rw', db.contacts, db.meta, async () => {
    await setMeta('possibleDuplicates', resolvePair(await readPossibleDuplicates(), id, resolution))
  })
}

/** Review integration (#58): prepareMerge is read-only. Present both saved classifications,
 * sharedValues and proposedSurvivor, then pass keepDecisionFrom on confirmation.
 * MergeComparison in features/import implements that review; retain result.mergeId for
 * undoMerge, or mount MergeRecovery to recover persisted entries after navigation. */
