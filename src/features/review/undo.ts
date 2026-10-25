import { liveQuery } from 'dexie'
import { db } from '@/db/schema'
import { saveDecision, saveDecisions, StaleDecisionError } from '@/db/repo'
import type { Decision } from '@/domain/types'
import { dismissToast, toast, type ToastHandle, type ToastTone } from '@/ui/toast'

export interface UndoSnapshot { before: Decision[]; after: Decision[] }
const versions = new Map<string, number>()
let observing = false

// Toast validity is synchronous. Live database versions provide an early check;
// the transaction below is authoritative, including changes racing this cache.
export function observeVersions(decisions: Decision[]) {
  for (const decision of decisions) versions.set(decision.contactId, decision.updatedAt)
  if (observing) return
  observing = true
  liveQuery(() => db.decisions.toArray()).subscribe({
    next: rows => {
      versions.clear()
      for (const row of rows) versions.set(row.contactId, row.updatedAt)
    },
    error: () => { versions.clear(); observing = false },
  })
}

export const decisionUnchangedSince = (contactId: string, updatedAt: number) => versions.get(contactId) === updatedAt
export const snapshotUnchanged = (snapshot: UndoSnapshot) => snapshot.after.every(d => decisionUnchangedSince(d.contactId, d.updatedAt))

/** #55: check every row before any write, inside the same transaction as saveDecisions. */
export async function undoDecisions({ before, after }: UndoSnapshot) {
  await db.transaction('rw', db.decisions, db.tags, async () => {
    const stored = await db.decisions.bulkGet(after.map(d => d.contactId))
    after.forEach((d, index) => {
      if (stored[index]?.updatedAt !== d.updatedAt) throw new StaleDecisionError(d.contactId, stored[index])
    })
    await saveDecisions(before)
  })
}

export function rowUndoToast(before: Decision, after: Decision, message: string, tone: ToastTone): ToastHandle {
  observeVersions([after])
  let pending = false
  const handle = toast(message, { duration: 10000, priority: 'high', tone,
    validUntil: () => decisionUnchangedSince(after.contactId, after.updatedAt),
    action: { label: 'Undo', onClick: () => {
      if (pending) return
      pending = true
      void saveDecision(before, { expectedUpdatedAt: after.updatedAt }).then(() => {
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
