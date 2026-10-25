import { useLayoutEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { recoveryHistory, RESTORE_UNDO_MS } from '@/export/recovery'
import { removeRecoveryEntry } from '@/export/json'
import { canUndoMerge, undoMerge } from '@/import/merge'
import { useRecoveryStore, type RecoveryEntry } from '@/ui/recoveryStore'

/** #65: the repository owns merge IDs, expiry and guards on every recovery surface. */
export function useMergeRecovery() {
  const store = useRecoveryStore()
  const [retry, setRetry] = useState(0)
  const saved = useLiveQuery(async () => {
    try {
      const entries: RecoveryEntry[] = []
      for (const entry of await recoveryHistory()) {
        if (entry.kind !== 'merge' || entry.at + RESTORE_UNDO_MS <= Date.now()) continue
        // Subscribe to affected data so edits refresh both surfaces immediately.
        const allowed = await canUndoMerge(entry.id)
        entries.push({ id: entry.id, kind: 'merge', at: entry.at, ttlMs: RESTORE_UNDO_MS, revision: String(allowed),
          label: 'Merged ' + entry.snapshot.dump.contacts.map(contact => contact.displayName).join(' and '),
          canUndo: () => canUndoMerge(entry.id),
          onUndo: async () => await undoMerge(entry.id) === true,
          onDismiss: () => removeRecoveryEntry(entry.id),
        })
      }
      return { entries, error: '' }
    } catch { return { error: 'Could not load merge recovery. Please try again.' } }
  }, [retry])
  useLayoutEffect(() => { if (saved?.entries) store.hydrate(saved.entries) }, [saved, store])
  return { entries: store.list().filter(entry => entry.kind === 'merge'), error: saved?.error,
    retry: () => setRetry(value => value + 1) }
}
