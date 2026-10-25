import { liveQuery } from 'dexie'
import { db } from '@/db/schema'
import { saveDecision, StaleDecisionError } from '@/db/repo'
import type { Decision } from '@/domain/types'
import { recoveryStore, type RecoveryEntry } from '@/ui/recoveryStore'
import { dismissToast, toast, type ToastHandle, type ToastTone } from '@/ui/toast'

export interface UndoSnapshot { before: Decision[]; after: Decision[]; recoveryId?: string }
const versions = new Map<string, Decision>()
let observing = false

/** Compare every field, including optional fields, arrays and nested skip counters. */
export function sameDecision(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameDecision(left[key], right[key]))
}

// Toast checks are advisory; all writes also validate in the transaction below.
export function observeVersions(decisions: Decision[]) {
  for (const decision of decisions) versions.set(decision.contactId, structuredClone(decision))
  if (observing) return
  observing = true
  liveQuery(() => db.decisions.toArray()).subscribe({
    next: rows => {
      versions.clear()
      for (const row of rows) versions.set(row.contactId, row)
    },
    error: () => { versions.clear(); observing = false },
  })
}
export const snapshotUnchanged = (snapshot: UndoSnapshot) => snapshot.after.every(d => sameDecision(versions.get(d.contactId), d))
export async function canUndoDecisions(snapshot: UndoSnapshot): Promise<boolean> {
  const stored = await db.decisions.bulkGet(snapshot.after.map(d => d.contactId))
  return snapshot.after.every((decision, index) => sameDecision(stored[index], decision))
}

/** #55/#61: validate the complete batch before any exact write, in one transaction. */
export async function undoDecisions({ before, after, recoveryId }: UndoSnapshot) {
  await db.transaction('rw', db.decisions, db.tags, async () => {
    const stored = await db.decisions.bulkGet(after.map(d => d.contactId))
    after.forEach((d, index) => {
      if (!sameDecision(stored[index], d)) throw new StaleDecisionError(d.contactId, stored[index])
    })
    for (const decision of before) {
      const expected = after.find(d => d.contactId === decision.contactId)!
      await saveDecision(decision, { exact: true, expectedUpdatedAt: expected.updatedAt })
    }
  })
  if (recoveryId) recoveryStore.remove(recoveryId)
}

/** Owned by the screen-independent store, so departing rows/tabs cannot lose Undo. */
export function registerDecisionRecovery(input: UndoSnapshot, label: string): UndoSnapshot {
  const id = 'review-' + crypto.randomUUID()
  const snapshot = { ...structuredClone(input), recoveryId: id }
  const entry: RecoveryEntry = {
    id, label, at: Date.now(), canUndo: () => canUndoDecisions(snapshot), onDismiss: () => {},
    onUndo: async () => {
      try { await undoDecisions(snapshot) }
      catch (error) {
        if (!(error instanceof StaleDecisionError)) throw error
        recoveryStore.add({ ...entry, canUndo: async () => false })
        return false
      }
    },
  }
  recoveryStore.add(entry)
  return snapshot
}

export function rowUndoToast(before: Decision, after: Decision, message: string, tone: ToastTone): ToastHandle {
  const snapshot = registerDecisionRecovery({ before: [before], after: [after] }, message)
  observeVersions([after])
  let pending = false
  const handle = toast(message, { duration: 10000, priority: 'high', tone,
    validUntil: () => snapshotUnchanged(snapshot),
    action: { label: 'Undo', onClick: () => {
      if (pending) return
      pending = true
      void undoDecisions(snapshot).then(() => {
        dismissToast(handle.id)
        toast('Move undone')
      }).catch(error => {
        dismissToast(handle.id)
        toast(error instanceof StaleDecisionError ? 'Changed since — not undone' : 'Could not undo. Please try again.', { priority: 'high' })
      }).finally(() => { pending = false })
    } },
  })
  return handle
}
