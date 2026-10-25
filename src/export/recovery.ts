import { getMeta, setMeta, type Dump, type RestoreMode } from '@/db/repo'
import type { Contact, Decision } from '@/domain/types'
import type { DuplicatePair } from '@/import/duplicates'

export const RESTORE_UNDO_MS = 10 * 60 * 1000
export interface RecoverySnapshot {
  dump: Dump
  photos: Array<{ id: string; photo: Blob }>
}
export interface RestoreEntry {
  readonly id: string
  kind: 'restore'
  at: number
  mode: RestoreMode
  snapshot: RecoverySnapshot & { pairs?: DuplicatePair[] }
  revisionAfter: string
  backupAt?: string
}
export interface MergeEntry {
  readonly id: string
  kind: 'merge'
  at: number
  aId: string
  bId: string
  snapshot: RecoverySnapshot & { pairs: DuplicatePair[] }
  expected: { contact: Contact; decision?: Decision; pairs: DuplicatePair[] }
}
export type RecoveryEntry = RestoreEntry | MergeEntry
export const recoveryId = () => globalThis.crypto?.randomUUID?.()
  ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)

/** Legacy restore entries predate the discriminator. Reading never discards history. */
export async function recoveryHistory(): Promise<RecoveryEntry[]> {
  return (await getMeta<RecoveryEntry[]>('restoreHistory', []))
    .map(entry => entry.kind === 'merge' ? entry : { ...entry, kind: 'restore' })
}
export const restoreHistory = recoveryHistory
export const restoreEntries = async () => (await recoveryHistory())
  .filter((entry): entry is RestoreEntry => entry.kind === 'restore')

/** #1/#56: no capacity eviction. All unexpired entries survive every history mutation. */
export function saveRecoveryHistory(entries: RecoveryEntry[]): Promise<void> {
  const now = Date.now()
  return setMeta('restoreHistory', entries.filter(entry => now - entry.at < RESTORE_UNDO_MS))
}
/** Call inside the transaction that commits the operation being recovered. */
export async function addRecovery(entry: RecoveryEntry): Promise<void> {
  await saveRecoveryHistory([...(await recoveryHistory()), entry])
}

/** Property order and absent optional values do not change stored semantics. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}'
  }
  return JSON.stringify(value) ?? ''
}
