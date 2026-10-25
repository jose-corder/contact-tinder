import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { recoveryHistory, RESTORE_UNDO_MS } from '@/export/recovery'
import { undoMerge } from '@/import/duplicates'
import { Button, InlineNotice } from '@/ui'

/** Persisted recovery independent of transient toasts or the departing duplicate row. */
export default function MergeRecovery() {
  const entries = useLiveQuery(recoveryHistory)
  const [now, setNow] = useState(Date.now)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  async function undo(id: string) {
    if (locked.current) return
    locked.current = true; setBusy(true); setMessage('')
    try {
      const result = await undoMerge(id)
      setMessage(typeof result === 'object' ? result.reason : result ? 'Merge undone.' : 'This merge recovery is no longer available.')
    } catch { setMessage('Could not undo the merge. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <div className="space-y-3">
    {(entries ?? []).filter(entry => entry.kind === 'merge' && now - entry.at < RESTORE_UNDO_MS).map(entry =>
      <section key={entry.id} aria-label="Merge recovery" className="space-y-1 break-words">
        <p className="t-body">Merged {entry.snapshot.dump.contacts.map(c => c.displayName).join(' and ')} at {new Date(entry.at).toLocaleTimeString()}.</p>
        <Button variant="outline" disabled={busy} onClick={() => void undo(entry.id)}>Undo merge</Button>
      </section>)}
    {message && <InlineNotice tone="info">{message}</InlineNotice>}
  </div>
}
