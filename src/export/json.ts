import { dumpAll, restoreAll, setMeta, getMeta, type Dump, type RestoreMode } from '@/db/repo'
import { db } from '@/db/schema'
import { hash } from '@/import/hash'

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
  /** Mode-independent identities. Removed applies only to Replace. */
  details: { addedIds: string[]; changedIds: string[]; removedIds: string[]; decisionRemovedIds: string[] }
}

// Ignore property order, including for import-owned metadata preserved in backups.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).filter((key) => value[key] !== undefined).sort()
    .map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  return JSON.stringify(value) ?? ''
}

/** Read-only comparison with a consistent live snapshot; no file selection writes. */
export async function previewRestore(text: string): Promise<RestorePreview> {
  const backup = parseBackup(text)
  const live = await db.transaction('r', db.contacts, db.decisions, () => dumpAll())
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
    added: addedIds.length, changed: changedIds.length, removed: removedIds.length,
    details: { addedIds, changedIds, removedIds, decisionRemovedIds } }
}

export const RESTORE_UNDO_MS = 10 * 60 * 1000
interface RestoreUndo { dump: Dump; at: number; photos: Array<{ id: string; photo: Blob }>; revisionAfterRestore: string }

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
  return { dump: await dumpAll(), photos: (await db.contacts.toArray()).flatMap((c) => c.photo ? [{ id: c.id, photo: c.photo }] : []) }
}

export async function restoreJson(text: string, mode: RestoreMode = 'replace'): Promise<{ contacts: number; decisions: number }> {
  const parsed = parseBackup(text)
  await db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const before = mode === 'replace' ? await snapshotState() : null
    await restoreAll(parsed, mode)
    await setMeta('restoreUndo', before ? { ...before, at: Date.now(), revisionAfterRestore: await dbRevision() } satisfies RestoreUndo : null)
  })
  return { contacts: parsed.contacts.length, decisions: parsed.decisions.length }
}

export type UndoRestoreResult = boolean | { conflict: true; preview: RestorePreview; revision: string }

/** Approval is bound to the reviewed revision; another edit always requires another review. */
export async function undoRestore(approvedRevision?: string): Promise<UndoRestoreResult> {
  return db.transaction('rw', db.contacts, db.decisions, db.tags, db.meta, async () => {
    const snapshot = await getMeta<RestoreUndo | null>('restoreUndo', null)
    if (!snapshot) return false
    if (Date.now() - snapshot.at >= RESTORE_UNDO_MS) {
      await db.meta.delete('restoreUndo')
      return false
    }
    const revision = await dbRevision()
    const changed = revision !== snapshot.revisionAfterRestore
    if (changed && approvedRevision !== revision) {
      return { conflict: true, preview: await previewRestore(JSON.stringify(snapshot.dump)), revision }
    }
    const newer = changed ? await snapshotState() : null
    await restoreAll(snapshot.dump, 'replace')
    // Clear inherited photos too: absence in the snapshot is meaningful.
    await db.contacts.toCollection().modify((contact) => { delete contact.photo })
    for (const { id, photo } of snapshot.photos ?? []) await db.contacts.update(id, { photo })
    if (newer) await setMeta('restoreUndo', { ...newer, at: Date.now(), revisionAfterRestore: await dbRevision() } satisfies RestoreUndo)
    else await db.meta.delete('restoreUndo')
    return true
  })
}
