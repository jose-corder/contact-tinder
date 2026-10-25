import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router'
import { getMeta } from '@/db/repo'
import { RESTORE_UNDO_MS, undoRestore, type UndoRestoreResult } from '@/export/json'
import { Button, InlineNotice } from '@/ui'
import { toast } from '@/ui/toast'

type Conflict = Exclude<UndoRestoreResult, boolean>

/** Persistent recovery remains available after unrelated toasts and Settings remounts. */
export function useRestoreRecovery() {
  const navigate = useNavigate()
  const location = useLocation()
  const mounted = useRef(true)
  const saved = useLiveQuery(() => getMeta<{ at: number } | null>('restoreUndo', null))
  const [now, setNow] = useState(Date.now)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const available = !!saved && now - saved.at < RESTORE_UNDO_MS
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!location.state?.reviewRestoreUndo) return
    navigate(location.pathname + location.search, { replace: true, state: null })
    void undo()
  }, [location.key]) // A toast clicked on another route returns here for review.
  useEffect(() => {
    if (!saved) return
    setNow(Date.now())
    const timer = setTimeout(() => { setNow(Date.now()); setConflict(null) }, Math.max(0, saved.at + RESTORE_UNDO_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [saved])
  useEffect(() => {
    if (!conflict) return
    let disclosure = heading.current?.closest('details')
    while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') }
    heading.current?.focus()
  }, [conflict])

  function announce(message: string) {
    const options = { priority: 'high' as const, duration: RESTORE_UNDO_MS, action: { label: 'Undo', onClick: () => { void undo() } } }
    toast(message, options)
  }

  async function undo(revision?: string) {
    if (locked.current) return
    locked.current = true; setBusy(true); setMessage('')
    try {
      const result = await undoRestore(revision)
      if (typeof result === 'object') {
        if (mounted.current) setConflict(result)
        else navigate('/settings', { state: { reviewRestoreUndo: true } })
        return
      }
      setConflict(null)
      if (result && revision) announce('Rolled back · newer data can be recovered')
      else toast(result ? 'Restore undone' : 'Undo has expired')
    } catch { setMessage('Could not undo the restore. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }

  const preview = conflict?.preview
  const changed = preview ? new Set([...preview.details.changedIds, ...preview.details.decisionRemovedIds]).size : 0
  const recovery = <>
    {available && !conflict && <Button full variant="outline" loading={busy} onClick={() => void undo()}>Undo restore</Button>}
    {conflict && preview && <section aria-label="Review rollback" className="space-y-3 rounded-[20px] border border-control p-4">
      <h3 ref={heading} tabIndex={-1} className="font-serif t-heading">Review rollback</h3>
      <InlineNotice tone="info">Changes since the restore will be lost: +{preview.added} added · {changed} changed · {preview.removed} removed</InlineNotice>
      <Button full loading={busy} onClick={() => void undo(conflict.revision)}>Roll back anyway</Button>
      <Button full variant="ghost" disabled={busy} onClick={() => setConflict(null)}>Keep current data</Button>
    </section>}
    {message && <InlineNotice tone="error">{message}</InlineNotice>}
  </>
  return { recovery, announce }
}
