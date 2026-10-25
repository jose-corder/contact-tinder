import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router'
import { RESTORE_UNDO_MS, restoreHistory, undoRestore, type RestoreEntry, type UndoRestoreResult } from '@/export/json'
import { Button, InlineNotice } from '@/ui'
import { toast } from '@/ui/toast'

type Conflict = Exclude<UndoRestoreResult, boolean>
const dateLabel = (date: string | number) => new Date(date).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
})
const notice = (entry: RestoreEntry) => 'Restored from backup (' + dateLabel(entry.backupAt ?? entry.at) + ') ·'

/** #56: persisted notices and cross-route callbacks always carry the recovery ID. */
export function useRestoreRecovery() {
  const navigate = useNavigate()
  const location = useLocation()
  const mounted = useRef(true)
  const saved = useLiveQuery(restoreHistory)
  const [now, setNow] = useState(Date.now)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const available = (saved ?? []).filter(entry => now - entry.at < RESTORE_UNDO_MS)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const id = location.state?.reviewRestoreUndo
    if (typeof id !== 'string') return
    navigate(location.pathname + location.search, { replace: true, state: null })
    void undo(id)
  }, [location.key])
  useEffect(() => { setNow(Date.now()) }, [saved])
  useEffect(() => {
    const expires = (saved ?? []).map(entry => entry.at + RESTORE_UNDO_MS).filter(at => at > Date.now())
    if (!expires.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(...expires) - Date.now()))
    return () => clearTimeout(timer)
  }, [saved, now])
  useEffect(() => {
    if (conflict && saved && !available.some(entry => entry.id === conflict.restoreId)) setConflict(null)
  }, [saved, now, conflict])
  useLayoutEffect(() => {
    if (!conflict) return
    let disclosure = heading.current?.closest('details')
    while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') }
    heading.current?.focus()
  }, [conflict])

  async function announce(id: string) {
    const entry = (await restoreHistory()).find(item => item.id === id)
    if (!entry) return
    // Platform adoption: retain ToastHandle, dismissToast(handle.id), and validUntil.
    // Keep this short: the full ten-minute recovery lives in the persistent notice.
    toast(notice(entry), { priority: 'high', duration: 4000,
      action: { label: 'Undo', onClick: () => { void undo(id) } } })
  }

  async function undo(id: string, revision?: string) {
    if (locked.current) return
    locked.current = true; setBusy(true); setMessage('')
    try {
      const result = await undoRestore(id, revision)
      if (typeof result === 'object') {
        if (mounted.current) setConflict(result)
        else navigate('/settings', { state: { reviewRestoreUndo: id } })
        return
      }
      setConflict(null)
      if (result && revision) {
        const newer = (await restoreHistory()).at(-1)
        if (newer) await announce(newer.id)
      } else toast(result ? 'Restore undone' : 'Undo has expired')
    } catch { setMessage('Could not undo the restore. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }

  const preview = conflict?.preview
  const changed = preview ? new Set([...preview.details.changedIds, ...preview.details.decisionRemovedIds]).size : 0
  const recovery = <>
    {!conflict && available.slice().reverse().map(entry => <div key={entry.id} className="space-y-1" data-restore-id={entry.id}>
      <p className="t-meta text-ink-2">{notice(entry)} <button type="button" className="hit-44 underline"
        aria-label="Undo restore" disabled={busy} onClick={() => void undo(entry.id)}>Undo</button></p>
      <p className="t-meta text-ink-2">{entry.mode === 'merge' ? 'Merged' : 'Replaced'} at {new Date(entry.at).toLocaleTimeString()} · You can undo this restore for 10 minutes.</p>
    </div>)}
    {conflict && preview && <section aria-label="Review rollback" className="space-y-3 rounded-[20px] border border-control p-4">
      <h3 ref={heading} tabIndex={-1} className="font-serif t-heading">Review rollback</h3>
      <InlineNotice tone="info">Changes since the restore will be lost: +{preview.added} added · {changed} changed · {preview.removed} removed</InlineNotice>
      <Button full loading={busy} onClick={() => void undo(conflict.restoreId, conflict.revision)}>Roll back data</Button>
      <Button full variant="ghost" disabled={busy} onClick={() => setConflict(null)}>Keep current data</Button>
    </section>}
    {message && <InlineNotice tone="error">{message}</InlineNotice>}
  </>
  return { recovery, announce }
}
