import Dexie from 'dexie'
import { db } from '@/db/schema'
import { allContacts, deleteContacts, saveDecision, saveDecisions, setMeta, upsertContacts } from '@/db/repo'
import type { Contact, Decision } from '@/domain/types'
import { addRecovery, canonical, recoveryHistory, recoveryId, RESTORE_UNDO_MS, saveRecoveryHistory, type MergeEntry } from '@/export/recovery'
import { fileBytes } from '@/export/zip'
import { mergeContactFields } from './dedupe'
import { readStoredPairs } from './duplicates'
import { decisionsConflict, proposedDecision, type DecisionChoice } from './mergeDecision'
import { remapPairs, sharedValues, touches } from './remapPairs'
import { recoveryStore } from '@/ui/recoveryStore'

export interface MergeComparison {
  a: Contact
  b: Contact
  sharedValues: { phones: string[]; emails: string[] }
  aDecision?: Decision
  bDecision?: Decision
  conflict: boolean
  proposedSurvivor: Contact
}
export interface MergeOptions {
  keepDecisionFrom?: DecisionChoice
  /** Optional comparison guard: a stale review must be shown again before saving. */
  expected?: MergeComparison
}
export interface MergeResult { mergeId: string; survivor: Contact; decision?: Decision }
export type UndoMergeResult = boolean | { conflict: true; reason: string }

/** #58: read-only, consistent comparison. Closing it does not mutate any table. */
export async function prepareMerge(aId: string, bId: string): Promise<MergeComparison> {
  if (aId === bId) throw new Error('Choose two different contacts to merge.')
  return db.transaction('r', db.contacts, db.decisions, async () => {
    const [a, b] = await db.contacts.bulkGet([aId, bId])
    if (!a || !b) throw new Error('A contact in this pair no longer exists. Refresh the duplicate list.')
    const [aDecision, bDecision] = await db.decisions.bulkGet([aId, bId])
    return { a, b, aDecision, bDecision, sharedValues: sharedValues(a, b),
      conflict: decisionsConflict(aDecision, bDecision), proposedSurvivor: mergeContactFields(a, b) }
  })
}

async function sameContact(a: Contact | undefined, b: Contact): Promise<boolean> {
  if (!a) return false
  const { photo: ap, ...ac } = a, { photo: bp, ...bc } = b
  if (canonical(ac) !== canonical(bc) || !!ap !== !!bp) return false
  if (!ap || !bp) return true
  if (ap.size !== bp.size || ap.type !== bp.type) return false
  const [ab, bb] = await Promise.all([fileBytes(ap), fileBytes(bp)])
  return ab.every((byte, i) => byte === bb[i])
}

/** #58/#59: fields, classification, tags, candidates and recovery commit together. */
export async function mergePair(aId: string, bId: string, options: MergeOptions = {}): Promise<MergeResult> {
  return db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const comparison = await prepareMerge(aId, bId)
    const { a, b, aDecision, bDecision, proposedSurvivor } = comparison
    const choice = options.keepDecisionFrom
    if (choice !== undefined && !['a', 'b', 'union'].includes(choice)) throw new Error('Choose a classification to keep.')
    if (comparison.conflict && !choice) throw new Error('Review the conflicting classifications and choose which to keep.')
    if (options.expected) {
      const expected = options.expected
      if (canonical([aDecision, bDecision]) !== canonical([expected.aDecision, expected.bDecision])
        || !await Dexie.waitFor(sameContact(a, expected.a)) || !await Dexie.waitFor(sameContact(b, expected.b))) {
        throw new Error('These contacts changed. Refresh the comparison before merging.')
      }
    }
    // Read every candidate while both records still exist, before any deletion/pruning.
    const pairs = await readStoredPairs()
    const nextPairs = remapPairs(pairs, proposedSurvivor, bId, await allContacts())
    const decision = proposedDecision(aId, aDecision, bDecision, choice)
    if (decision) decision.updatedAt = Math.max(Date.now(), (aDecision?.updatedAt ?? 0) + 1, (bDecision?.updatedAt ?? 0) + 1)
    const entry: MergeEntry = {
      id: recoveryId(), kind: 'merge', at: Date.now(), aId, bId,
      snapshot: {
        dump: { version: 1, exportedAt: new Date().toISOString(),
          contacts: [a, b].map(({ photo: _photo, ...contact }) => contact),
          decisions: [aDecision, bDecision].filter((d): d is Decision => !!d) },
        photos: [a, b].flatMap(c => c.photo ? [{ id: c.id, photo: c.photo }] : []),
        pairs: pairs.filter(pair => touches(pair, aId, bId)),
      },
      expected: { contact: proposedSurvivor, decision, pairs: nextPairs.filter(pair => touches(pair, aId, bId)) },
    }
    await addRecovery(entry)
    await upsertContacts([proposedSurvivor])
    // Moving a saved classification is not a completion action (#61).
    if (decision) await saveDecision(decision, { exact: true })
    await deleteContacts([bId])
    await setMeta('possibleDuplicates', nextPairs)
    return { mergeId: entry.id, survivor: proposedSurvivor, decision }
  })
}

/** #58/#61: reject any changed affected state; unrelated work and history survive. */
export async function undoMerge(id: string): Promise<UndoMergeResult> {
  const result = await db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async (): Promise<UndoMergeResult> => {
    const history = await recoveryHistory()
    const entry = history.find(item => item.id === id)
    if (!entry || entry.kind !== 'merge') return false
    if (Date.now() - entry.at >= RESTORE_UNDO_MS) {
      await saveRecoveryHistory(history)
      return false
    }
    const { aId, bId, snapshot } = entry
    const pairs = await readStoredPairs()
    if (!await mergeUnchanged(entry)) {
      return { conflict: true, reason: 'The merged contact or its comparisons changed. Undo would overwrite newer work.' }
    }
    await deleteContacts([aId, bId])
    const photos = new Map(snapshot.photos.map(item => [item.id, item.photo]))
    await upsertContacts(snapshot.dump.contacts.map(c => photos.has(c.id) ? { ...c, photo: photos.get(c.id) } : c))
    await saveDecisions(snapshot.dump.decisions, { exact: true })
    await setMeta('possibleDuplicates', [...pairs.filter(pair => !touches(pair, aId, bId)), ...snapshot.pairs])
    await saveRecoveryHistory(history.filter(item => item.id !== id))
    return true
  })
  if (typeof result === 'boolean') recoveryStore.remove(id)
  return result
}

async function mergeUnchanged({ aId, bId, expected }: MergeEntry): Promise<boolean> {
  const [a, b] = await db.contacts.bulkGet([aId, bId])
  const [ad, bd] = await db.decisions.bulkGet([aId, bId])
  const pairs = await readStoredPairs()
  return !b && !bd && canonical(ad) === canonical(expected.decision)
    && canonical(pairs.filter(pair => touches(pair, aId, bId))) === canonical(expected.pairs)
    && await Dexie.waitFor(sameContact(a, expected.contact))
}

/** #65: both presenters use the same advisory check as the atomic Undo guard. */
export async function canUndoMerge(id: string): Promise<boolean> {
  return db.transaction('r', db.contacts, db.decisions, db.meta, async () => {
    const entry = (await recoveryHistory()).find(item => item.id === id)
    return !!entry && entry.kind === 'merge' && Date.now() - entry.at < RESTORE_UNDO_MS && await mergeUnchanged(entry)
  })
}
