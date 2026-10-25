import { dumpAll, getMeta, restoreAll, setMeta, type Dump, type RestoreMode } from '@/db/repo'
import { db } from '@/db/schema'
import { hash } from '@/import/hash'
import { readStoredPairs, type DuplicatePair } from '@/import/duplicates'
import { recoveryStore } from '@/ui/recoveryStore'
import { canonical, recoveryId, recoveryHistory, saveRecoveryHistory, RESTORE_UNDO_MS, type RestoreEntry } from './recovery'
export { RESTORE_UNDO_MS, restoreHistory, recoveryHistory, type RestoreEntry, type RecoveryEntry, type MergeEntry } from './recovery'

type RecordValue = Record<string, unknown>
const object = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalString = (value: unknown) => value === undefined || typeof value === 'string'
const choice = (value: unknown, choices: string[]) => value === undefined || (typeof value === 'string' && choices.includes(value))
const choices = (value: unknown, allowed: string[]) => strings(value) && value.every((v) => allowed.includes(v))

function validContact(value: unknown): boolean {
  if (!object(value)) return false
  const entries = (v: unknown) => Array.isArray(v) && v.every((e: unknown) => object(e) && typeof e.value === 'string' && optionalString(e.type) && optionalString(e.e164))
  return typeof value.id === 'string' && value.id.length > 0 && typeof value.displayName === 'string'
    && ['givenName', 'familyName', 'org', 'title', 'notes', 'rev'].every((key) => optionalString(value[key]))
    && entries(value.phones) && entries(value.emails) && typeof value.raw === 'string'
    && typeof value.source === 'string' && ['vcf', 'csv', 'picker', 'demo'].includes(value.source)
    && finite(value.importedAt) && !Number.isNaN(new Date(value.importedAt).getTime())
    && strings(value.phoneKeys) && strings(value.emailKeys)
}

function validDecision(value: unknown): boolean {
  if (!object(value) || !object(value.skips)) return false
  const skips = value.skips
  return typeof value.contactId === 'string' && value.contactId.length > 0
    && choice(value.bucket, ['delete', 'work', 'personal'])
    && choice(value.workStatus, ['old', 'current', 'potential'])
    && choices(value.workTypes, ['client', 'vendor', 'relationship', 'namedrop'])
    && choice(value.relation, ['friend', 'family', 'ex', 'other'])
    && choices(value.personalTypes, ['acquaintance', 'neighbor', 'service'])
    && strings(value.customTags) && finite(value.updatedAt)
    && ['triage', 'work', 'personal'].every((key) => finite(skips[key]) && Number.isInteger(skips[key]) && skips[key] >= 0)
}

function validDump(value: unknown): value is Dump {
  return object(value) && value.version === 1 && typeof value.exportedAt === 'string'
    && Array.isArray(value.contacts) && value.contacts.every(validContact)
    && Array.isArray(value.decisions) && value.decisions.every(validDecision)
}

export async function backupJson(): Promise<string> {
  return JSON.stringify(await dumpAll(), null, 2)
}

/**
 * Restore a backup. `replace` (default) makes this device match the snapshot exactly;
 * `merge` upserts the snapshot on top of what is already here. See repo.restoreAll.
 */
function parseBackup(text: string): Dump {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  if (!validDump(parsed)) throw new Error('Invalid backup. Choose a Contacts. version 1 backup with valid contacts and decisions.')
  const ids = new Set<string>()
  for (const c of parsed.contacts) {
    if (ids.has(c.id)) throw new Error('Invalid backup: duplicate contact ids.')
    ids.add(c.id)
  }
  const decisions = new Set<string>()
  for (const d of parsed.decisions) {
    if (!ids.has(d.contactId) || decisions.has(d.contactId)) throw new Error('Invalid backup: duplicate or missing decision contact ids.')
    decisions.add(d.contactId)
  }
  if (Number.isNaN(Date.parse(parsed.exportedAt))) throw new Error('Invalid backup: missing backup date.')
  return parsed
}

export interface RestorePreview {
  exportedAt: string
  contacts: number
  decisions: number
  added: number
  changed: number
  removed: number
  pairChanges: number
  /** Mode-independent identities. Removed applies only to Replace. */
  details: { addedIds: string[]; changedIds: string[]; removedIds: string[]; decisionRemovedIds: string[] }
}

/** Read-only comparison with a consistent live snapshot; no file selection writes. */
export async function previewRestore(text: string, pairs?: DuplicatePair[]): Promise<RestorePreview> {
  const backup = parseBackup(text)
  const { live, pairChanges } = await db.transaction('r', db.contacts, db.decisions, db.meta, async () => {
    const live = await dumpAll()
    if (!pairs) return { live, pairChanges: 0 }
    const stored = new Map((await readStoredPairs()).map(pair => [pair.id, canonical(pair)]))
    const target = new Map(pairs.map(pair => [pair.id, canonical(pair)]))
    const ids = new Set([...stored.keys(), ...target.keys()])
    return { live, pairChanges: [...ids].filter(id => stored.get(id) !== target.get(id)).length }
  })
  const contacts = new Map(live.contacts.map((c) => [c.id, c]))
  const decisions = new Map(live.decisions.map((d) => [d.contactId, canonical(d)]))
  const incoming = new Map(backup.contacts.map((c) => [c.id, c]))
  const incomingDecisions = new Map(backup.decisions.map((d) => [d.contactId, canonical(d)]))
  const addedIds = backup.contacts.filter((c) => !contacts.has(c.id)).map((c) => c.id)
  const changedIds = backup.contacts.filter((c) => contacts.has(c.id) &&
    (canonical(c) !== canonical(contacts.get(c.id)) ||
      (incomingDecisions.has(c.id) && incomingDecisions.get(c.id) !== decisions.get(c.id))))
    .map((c) => c.id)
  const removedIds = live.contacts.filter((c) => !incoming.has(c.id)).map((c) => c.id)
  const decisionRemovedIds = live.decisions.filter((d) => incoming.has(d.contactId) && !incomingDecisions.has(d.contactId)).map((d) => d.contactId)
  return { exportedAt: backup.exportedAt, contacts: backup.contacts.length, decisions: backup.decisions.length,
    added: addedIds.length, changed: changedIds.length, removed: removedIds.length, pairChanges,
    details: { addedIds, changedIds, removedIds, decisionRemovedIds } }
}

/** Content revision, independent of metadata. Hashes also catch same-timestamp edits and enrichment imports. */
export async function dbRevision(): Promise<string> {
  return db.transaction('r', db.contacts, db.decisions, async () => {
    const [contacts, decisions] = await Promise.all([db.contacts.toArray(), db.decisions.toArray()])
    const maxUpdatedAt = decisions.reduce((max, d) => Math.max(max, d.updatedAt), 0)
    return `${contacts.length}:${decisions.length}:${maxUpdatedAt}:${hash(canonical([
      contacts.map(({ photo, ...c }) => [c, photo?.size, photo?.type]), decisions,
    ]))}`
  })
}

async function snapshotState() {
  return { dump: await dumpAll(), pairs: await readStoredPairs(), photos: (await db.contacts.toArray()).flatMap((c) => c.photo ? [{ id: c.id, photo: c.photo }] : []) }
}

/** #52: export revisions stay stable; rollback approvals also guard stored pair decisions. */
export async function restoreRevision(): Promise<string> {
  return db.transaction('r', db.contacts, db.decisions, db.meta, async () =>
    `${await dbRevision()}:pairs:${hash(canonical(await getMeta('possibleDuplicates', [])))}`)
}

/** #65: only remove the runtime action after persistence succeeds. */
export async function removeRecoveryEntry(id: string): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    await saveRecoveryHistory((await recoveryHistory()).filter(entry => entry.id !== id))
  })
  recoveryStore.remove(id)
}

export async function restoreJson(text: string, mode: RestoreMode = 'replace'): Promise<{ contacts: number; decisions: number; restoreId: string }> {
  const parsed = parseBackup(text)
  const id = recoveryId()
  await db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const snapshot = await snapshotState()
    const history = await recoveryHistory()
    await restoreAll(parsed, mode)
    const entry: RestoreEntry = { id, kind: 'restore', at: Date.now(), mode, snapshot,
      backupAt: parsed.exportedAt, revisionAfter: await restoreRevision() }
    await saveRecoveryHistory([...history, entry])
  })
  return { contacts: parsed.contacts.length, decisions: parsed.decisions.length, restoreId: id }
}

export type UndoRestoreResult = boolean | { conflict: true; preview: RestorePreview; revision: string; restoreId: string }

/** #56: both the recovery and any conflict approval target one immutable entry. */
export async function undoRestore(id: string, approvedRevision?: string): Promise<UndoRestoreResult> {
  return db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const history = await recoveryHistory()
    const entry = history.find(item => item.id === id)
    if (!entry || entry.kind !== 'restore') return false
    const remaining = history.filter(item => item.id !== id)
    if (Date.now() - entry.at >= RESTORE_UNDO_MS) {
      await saveRecoveryHistory(remaining)
      return false
    }
    const revision = await restoreRevision()
    const latestId = history.at(-1)?.id
    const changed = revision !== entry.revisionAfter || latestId !== id
    // An identical later restore still invalidates an older recovery/approval.
    const approvalRevision = revision + ':' + latestId
    if (changed && approvedRevision !== approvalRevision) {
      return { conflict: true, preview: await previewRestore(JSON.stringify(entry.snapshot.dump), entry.snapshot.pairs), revision: approvalRevision, restoreId: id }
    }
    const newer = changed ? await snapshotState() : null
    // repo.restoreAll uses exact decision writes (#61).
    await restoreAll(entry.snapshot.dump, 'replace')
    if (entry.snapshot.pairs) await setMeta('possibleDuplicates', entry.snapshot.pairs)
    // Absence of a thumbnail in the snapshot is meaningful too.
    await db.contacts.toCollection().modify(contact => { delete contact.photo })
    for (const { id, photo } of entry.snapshot.photos) await db.contacts.update(id, { photo })
    if (newer) remaining.push({ id: recoveryId(), kind: 'restore', at: Date.now(), mode: 'replace', snapshot: newer,
      backupAt: newer.dump.exportedAt, revisionAfter: await restoreRevision() })
    await saveRecoveryHistory(remaining)
    return true
  })
}
